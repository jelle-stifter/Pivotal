import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { PivotalDB } from './schema'
import { createRepo } from './repo'

let db: PivotalDB
let repo: ReturnType<typeof createRepo>

beforeEach(() => {
  db = new PivotalDB(`test-${Math.random()}`)
  repo = createRepo(db)
})

async function setup() {
  const h = await repo.addTeam('Thuis')
  const a = await repo.addTeam('Uit')
  const p = (teamId: string, name: string, number: number, gk: boolean) =>
    repo.addPlayer({ teamId, name, number, position: gk ? 'K' : 'R', isGoalkeeper: gk })
  const hgk = await p(h.id, 'HK', 1, true)
  const hp = await p(h.id, 'HP', 7, false)
  const agk = await p(a.id, 'AK', 12, true)
  const agk2 = await p(a.id, 'AK2', 16, true)
  const m = await repo.addMatch({
    homeTeamId: h.id,
    awayTeamId: a.id,
    date: '2026-11-08',
    format: 3,
  })
  return { h, a, hgk, hp, agk, agk2, m }
}

describe('repo', () => {
  it('rejects a match with identical teams', async () => {
    const t = await repo.addTeam('X')
    await expect(
      repo.addMatch({ homeTeamId: t.id, awayTeamId: t.id, date: '2026-01-01', format: 2 }),
    ).rejects.toThrow()
  })

  it('stamps period/clock and stores videoTimeMs null', async () => {
    const s = await setup()
    await repo.updateMatch(s.m.id, { currentPeriod: 2, clockMs: 61000 })
    const act = await repo.logAction({
      matchId: s.m.id, teamId: s.h.id, playerId: s.hp.id, type: 'shot',
    })
    expect(act.period).toBe(2)
    expect(act.matchClockMs).toBe(61000)
    expect(act.videoTimeMs).toBeNull()
    expect(act.schemaVersion).toBe(1)
  })

  it('stores the opposing active goalkeeper on goals and keeps it after a keeper change', async () => {
    const s = await setup()
    await repo.setActiveGoalkeeper(s.m.id, 'away', s.agk.id)
    const g1 = await repo.logAction({
      matchId: s.m.id, teamId: s.h.id, playerId: s.hp.id, type: 'goal',
    })
    await repo.setActiveGoalkeeper(s.m.id, 'away', s.agk2.id)
    const g2 = await repo.logAction({
      matchId: s.m.id, teamId: s.h.id, playerId: s.hp.id, type: 'goal',
    })
    expect((await db.actions.get(g1.id))?.goalkeeperId).toBe(s.agk.id)
    expect(g2.goalkeeperId).toBe(s.agk2.id)
  })

  it('uses the live clock value when given', async () => {
    const s = await setup()
    const a = await repo.logAction({
      matchId: s.m.id, teamId: s.h.id, playerId: s.hp.id, type: 'shot', clockMs: 4500,
    })
    expect(a.matchClockMs).toBe(4500)
    expect('clockMs' in a).toBe(false)
  })

  it('keeps goalkeeperId consistent when an action type is edited', async () => {
    const s = await setup()
    await repo.setActiveGoalkeeper(s.m.id, 'away', s.agk.id)
    const shot = await repo.logAction({
      matchId: s.m.id, teamId: s.h.id, playerId: s.hp.id, type: 'shot',
    })
    await repo.updateAction(shot.id, { type: 'goal' })
    expect((await db.actions.get(shot.id))?.goalkeeperId).toBe(s.agk.id)
    await repo.updateAction(shot.id, { type: 'foul' })
    expect((await db.actions.get(shot.id))?.goalkeeperId).toBeUndefined()
  })

  it('stores a position only when one is given, for every action type', async () => {
    const s = await setup()
    const types = ['goal', 'shot', 'turnover', 'save', 'interception', 'foul'] as const
    for (const type of types) {
      const withPos = await repo.logAction({
        matchId: s.m.id, teamId: s.h.id, playerId: s.hp.id, type, x: 0.8, y: 0.3,
      })
      const stored = await db.actions.get(withPos.id)
      expect(stored?.x).toBe(0.8)
      expect(stored?.y).toBe(0.3)
      const without = await repo.logAction({
        matchId: s.m.id, teamId: s.h.id, playerId: s.hp.id, type,
      })
      const bare = await db.actions.get(without.id)
      expect('x' in (bare ?? {})).toBe(false)
      expect('y' in (bare ?? {})).toBe(false)
    }
  })

  it('ignores an incomplete position (x without y)', async () => {
    const s = await setup()
    const a = await repo.logAction({
      matchId: s.m.id, teamId: s.h.id, playerId: s.hp.id, type: 'shot', x: 0.5,
    })
    expect((await db.actions.get(a.id))?.x).toBeUndefined()
  })

  it('sets, moves and clears the position of an existing action', async () => {
    const s = await setup()
    const a = await repo.logAction({
      matchId: s.m.id, teamId: s.h.id, playerId: s.hp.id, type: 'shot',
    })
    await repo.updateAction(a.id, { x: 0.9, y: 0.1 })
    expect(await db.actions.get(a.id)).toMatchObject({ x: 0.9, y: 0.1 })
    await repo.updateAction(a.id, { x: 0.2, y: 0.6 })
    expect(await db.actions.get(a.id)).toMatchObject({ x: 0.2, y: 0.6 })
    await repo.updateAction(a.id, { x: undefined, y: undefined })
    const cleared = await db.actions.get(a.id)
    expect('x' in (cleared ?? {})).toBe(false)
    expect('y' in (cleared ?? {})).toBe(false)
  })

  it('loads the demo season once, without duplicating when loaded twice', async () => {
    const id = await repo.loadDemo('2026-11-08')
    const counts = async () => ({
      teams: await db.teams.count(),
      players: await db.players.count(),
      matches: await db.matches.count(),
      actions: await db.actions.count(),
    })
    const first = await counts()
    expect(first.teams).toBe(2)
    expect(first.players).toBe(16)
    expect(first.matches).toBe(4)
    expect(first.actions).toBeGreaterThan(400)
    expect((await db.matches.get(id))?.date).toBe('2026-11-08')
    await repo.loadDemo('2026-11-08')
    expect(await counts()).toEqual(first)
  })

  it('removes only the demo data and leaves the user data untouched', async () => {
    const s = await setup()
    await repo.logAction({ matchId: s.m.id, teamId: s.h.id, playerId: s.hp.id, type: 'shot' })
    await repo.loadDemo('2026-11-08')
    await repo.removeDemo()
    expect(await db.teams.count()).toBe(2) // Thuis + Uit
    expect(await db.players.count()).toBe(4)
    expect(await db.matches.count()).toBe(1)
    expect(await db.actions.count()).toBe(1)
    await repo.removeDemo() // safe to call when nothing is loaded
    expect(await db.actions.count()).toBe(1)
  })

  it('credits the opposing keeper for 7-meter goals, saves and misses, not for other actions', async () => {
    const s = await setup()
    await repo.setActiveGoalkeeper(s.m.id, 'away', s.agk.id)
    const log = (type: Parameters<typeof repo.logAction>[0]['type']) =>
      repo.logAction({ matchId: s.m.id, teamId: s.h.id, playerId: s.hp.id, type })
    for (const type of ['goal', 'penalty_goal', 'penalty_saved', 'penalty_miss'] as const)
      expect((await log(type)).goalkeeperId).toBe(s.agk.id)
    for (const type of ['shot', 'assist', 'penalty_won', 'bad_pass', 'yellow_card'] as const)
      expect((await log(type)).goalkeeperId).toBeUndefined()
  })

  it('keeps the credited keeper when a goal is edited into a 7-meter goal', async () => {
    const s = await setup()
    await repo.setActiveGoalkeeper(s.m.id, 'away', s.agk.id)
    const g = await repo.logAction({
      matchId: s.m.id, teamId: s.h.id, playerId: s.hp.id, type: 'goal',
    })
    await repo.setActiveGoalkeeper(s.m.id, 'away', s.agk2.id) // keeper changed later
    await repo.updateAction(g.id, { type: 'penalty_goal' })
    expect((await db.actions.get(g.id))?.goalkeeperId).toBe(s.agk.id)
    await repo.updateAction(g.id, { type: 'assist' })
    expect((await db.actions.get(g.id))?.goalkeeperId).toBeUndefined()
  })

  it('does not set goalkeeperId on non-goal actions', async () => {
    const s = await setup()
    await repo.setActiveGoalkeeper(s.m.id, 'away', s.agk.id)
    const a = await repo.logAction({
      matchId: s.m.id, teamId: s.h.id, playerId: s.hp.id, type: 'shot',
    })
    expect(a.goalkeeperId).toBeUndefined()
  })

  it('undoes the most recent action only', async () => {
    const s = await setup()
    await repo.logAction({ matchId: s.m.id, teamId: s.h.id, playerId: s.hp.id, type: 'shot' })
    await new Promise((r) => setTimeout(r, 3))
    const second = await repo.logAction({
      matchId: s.m.id, teamId: s.h.id, playerId: s.hp.id, type: 'foul',
    })
    const undone = await repo.undoLastAction(s.m.id)
    expect(undone?.id).toBe(second.id)
    expect(await db.actions.count()).toBe(1)
  })

  it('enforces unique shirt numbers per team', async () => {
    const s = await setup()
    const dup = {
      teamId: s.h.id, name: 'Dup', number: 7, position: 'R', isGoalkeeper: false,
    }
    await expect(repo.addPlayer(dup)).rejects.toThrow()
    // same number in the other team is fine
    await repo.addPlayer({ ...dup, teamId: s.a.id })
    // renumbering onto an existing number fails; keeping own number works
    await expect(repo.updatePlayer(s.hgk.id, { number: 7 })).rejects.toThrow()
    await repo.updatePlayer(s.hp.id, { number: 7, name: 'Renamed' })
  })

  it('refuses to delete a player with actions or a team in a match', async () => {
    const s = await setup()
    await repo.logAction({ matchId: s.m.id, teamId: s.h.id, playerId: s.hp.id, type: 'shot' })
    await expect(repo.deletePlayer(s.hp.id)).rejects.toThrow()
    await expect(repo.deleteTeam(s.h.id)).rejects.toThrow()
  })

  it('deleting a match removes its actions', async () => {
    const s = await setup()
    await repo.logAction({ matchId: s.m.id, teamId: s.h.id, playerId: s.hp.id, type: 'shot' })
    await repo.deleteMatch(s.m.id)
    expect(await db.actions.count()).toBe(0)
    expect(await db.matches.count()).toBe(0)
  })
})
