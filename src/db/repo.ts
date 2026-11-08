import { db as defaultDb, type PivotalDB } from './schema'
import { buildDemo } from '../lib/demo'
import { KEEPER_FACED_TYPES } from '../lib/actions'
import {
  SCHEMA_VERSION,
  type Action,
  type ActionType,
  type Match,
  type MatchFormat,
  type Player,
  type Side,
  type Team,
} from '../types'

const uid = () => crypto.randomUUID()

export function createRepo(db: PivotalDB = defaultDb) {
  // Shirt numbers must be unique per team: keyboard entry selects by number.
  async function assertFreeNumber(
    teamId: string,
    number: number,
    exceptId?: string,
  ) {
    const clash = await db.players
      .where('teamId')
      .equals(teamId)
      .filter((p) => p.number === number && p.id !== exceptId)
      .count()
    if (clash > 0)
      throw new Error(`Rugnummer ${number} is al in gebruik in dit team`)
  }

  return {
    /**
     * Loads the finished demo match with teams, players and ~150 actions.
     * Ids are stable, so calling it twice replaces instead of duplicating.
     * Returns the id of the demo match.
     */
    async loadDemo(date: string): Promise<string> {
      const d = buildDemo(date, Date.now())
      await db.transaction(
        'rw',
        db.teams,
        db.players,
        db.matches,
        db.actions,
        async () => {
          await db.teams.bulkPut(d.teams)
          await db.players.bulkPut(d.players)
          await db.matches.bulkPut(d.matches)
          await db.actions.bulkPut(d.actions)
        },
      )
      return d.match.id
    },

    /** Removes only the demo data (by its stable ids); other data is untouched. */
    async removeDemo(): Promise<void> {
      const d = buildDemo('2000-01-01', 0)
      await db.transaction(
        'rw',
        db.teams,
        db.players,
        db.matches,
        db.actions,
        async () => {
          const ids = d.matches.map((m) => m.id)
          await db.actions.where('matchId').anyOf(ids).delete()
          await db.matches.bulkDelete(ids)
          await db.players.bulkDelete(d.players.map((p) => p.id))
          await db.teams.bulkDelete(d.teams.map((t) => t.id))
        },
      )
    },

    // Teams
    async addTeam(name: string): Promise<Team> {
      const team: Team = { id: uid(), name, schemaVersion: SCHEMA_VERSION }
      await db.teams.add(team)
      return team
    },
    async renameTeam(id: string, name: string) {
      await db.teams.update(id, { name })
    },
    async deleteTeam(id: string) {
      const used = await db.matches
        .filter((m) => m.homeTeamId === id || m.awayTeamId === id)
        .count()
      if (used > 0) throw new Error('Team wordt gebruikt in een wedstrijd')
      await db.transaction('rw', db.teams, db.players, async () => {
        await db.players.where('teamId').equals(id).delete()
        await db.teams.delete(id)
      })
    },

    // Players
    async addPlayer(p: Omit<Player, 'id' | 'schemaVersion'>): Promise<Player> {
      await assertFreeNumber(p.teamId, p.number)
      const player: Player = { ...p, id: uid(), schemaVersion: SCHEMA_VERSION }
      await db.players.add(player)
      return player
    },
    async updatePlayer(id: string, patch: Partial<Omit<Player, 'id'>>) {
      const current = await db.players.get(id)
      if (!current) throw new Error('Speler niet gevonden')
      await assertFreeNumber(
        patch.teamId ?? current.teamId,
        patch.number ?? current.number,
        id,
      )
      await db.players.update(id, patch)
    },
    async deletePlayer(id: string) {
      const used = await db.actions.where('playerId').equals(id).count()
      if (used > 0) throw new Error('Speler heeft acties in een wedstrijd')
      await db.players.delete(id)
    },

    // Matches
    async addMatch(m: {
      homeTeamId: string
      awayTeamId: string
      date: string
      location?: string
      format: MatchFormat
    }): Promise<Match> {
      if (m.homeTeamId === m.awayTeamId)
        throw new Error('Thuis- en uitteam moeten verschillen')
      const match: Match = {
        ...m,
        id: uid(),
        currentPeriod: 1,
        clockMs: 0,
        activeGoalkeeper: {},
        schemaVersion: SCHEMA_VERSION,
      }
      await db.matches.add(match)
      return match
    },
    async updateMatch(id: string, patch: Partial<Omit<Match, 'id'>>) {
      await db.matches.update(id, patch)
    },
    async setActiveGoalkeeper(
      matchId: string,
      side: Side,
      playerId: string | undefined,
    ) {
      const m = await db.matches.get(matchId)
      if (!m) throw new Error('Wedstrijd niet gevonden')
      await db.matches.update(matchId, {
        activeGoalkeeper: { ...m.activeGoalkeeper, [side]: playerId },
      })
    },
    async deleteMatch(id: string) {
      await db.transaction('rw', db.matches, db.actions, async () => {
        await db.actions.where('matchId').equals(id).delete()
        await db.matches.delete(id)
      })
    },

    // Actions
    /**
     * Logs an action. For goals, stores the opposing goalkeeper currently on
     * court so goals conceded stay correct if the keeper changes later.
     */
    async logAction(input: {
      matchId: string
      teamId: string
      playerId: string
      type: ActionType
      /** Live clock value; falls back to the last persisted match clock. */
      clockMs?: number
      /** Attack-normalized court position; both or neither. */
      x?: number
      y?: number
    }): Promise<Action> {
      const { clockMs, x, y, ...fields } = input
      const match = await db.matches.get(input.matchId)
      if (!match) throw new Error('Wedstrijd niet gevonden')
      let goalkeeperId: string | undefined
      if (KEEPER_FACED_TYPES.includes(input.type)) {
        const opposing: Side =
          input.teamId === match.homeTeamId ? 'away' : 'home'
        goalkeeperId = match.activeGoalkeeper[opposing]
      }
      const action: Action = {
        id: uid(),
        ...fields,
        period: match.currentPeriod,
        matchClockMs: clockMs ?? match.clockMs,
        createdAt: Date.now(),
        videoTimeMs: null,
        goalkeeperId,
        schemaVersion: SCHEMA_VERSION,
      }
      // Only store a position when a complete one was given.
      if (x !== undefined && y !== undefined) {
        action.x = x
        action.y = y
      }
      await db.actions.add(action)
      return action
    },
    async updateAction(
      id: string,
      patch: Partial<
        Pick<
          Action,
          | 'playerId'
          | 'teamId'
          | 'type'
          | 'period'
          | 'matchClockMs'
          | 'goalkeeperId'
          | 'x'
          | 'y'
        >
      >,
    ) {
      const current = await db.actions.get(id)
      if (!current) throw new Error('Actie niet gevonden')
      const next = { ...patch }
      // Keep goalkeeperId consistent when the action type changes.
      if (patch.type !== undefined && patch.type !== current.type) {
        const wasFaced = KEEPER_FACED_TYPES.includes(current.type)
        const isFaced = KEEPER_FACED_TYPES.includes(patch.type)
        if (isFaced && wasFaced) {
          // e.g. goal -> 7m goal: keep the keeper that was credited at the time
        } else if (isFaced) {
          const match = await db.matches.get(current.matchId)
          if (match) {
            const opposing: Side =
              (patch.teamId ?? current.teamId) === match.homeTeamId
                ? 'away'
                : 'home'
            next.goalkeeperId = match.activeGoalkeeper[opposing]
          }
        } else {
          next.goalkeeperId = undefined
        }
      }
      await db.actions.update(id, next)
    },
    async deleteAction(id: string) {
      await db.actions.delete(id)
    },
    async undoLastAction(matchId: string): Promise<Action | undefined> {
      const all = await db.actions.where('matchId').equals(matchId).toArray()
      const last = all.sort((a, b) => b.createdAt - a.createdAt)[0]
      if (last) await db.actions.delete(last.id)
      return last
    },
  }
}

export const repo = createRepo()
