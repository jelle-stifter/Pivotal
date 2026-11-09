import type { PivotalDB } from './schema'
import { SCHEMA_VERSION, type Action, type Match, type Player, type Team } from '../types'

export interface Backup {
  app: 'pivotal'
  schemaVersion: number
  exportedAt: string
  teams: Team[]
  players: Player[]
  matches: Match[]
  actions: Action[]
}

export async function createBackup(db: PivotalDB, now = new Date()): Promise<Backup> {
  const [teams, players, matches, actions] = await Promise.all([
    db.teams.toArray(),
    db.players.toArray(),
    db.matches.toArray(),
    db.actions.toArray(),
  ])
  return {
    app: 'pivotal',
    schemaVersion: SCHEMA_VERSION,
    exportedAt: now.toISOString(),
    teams,
    players,
    matches,
    actions,
  }
}

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

function rows(
  data: Record<string, unknown>,
  key: string,
  required: string[],
): Record<string, unknown>[] {
  const list = data[key]
  if (!Array.isArray(list)) throw new Error(`Back-up mist de lijst "${key}".`)
  for (const item of list) {
    if (!isObj(item) || required.some((f) => typeof item[f] !== 'string'))
      throw new Error(`Back-up bevat een ongeldig item in "${key}".`)
  }
  return list as Record<string, unknown>[]
}

/** Parse and validate a backup file. Throws a Dutch message when invalid. */
export function parseBackup(text: string): Backup {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('Dit is geen geldig back-upbestand (geen JSON).')
  }
  if (!isObj(data) || data.app !== 'pivotal')
    throw new Error('Dit bestand is geen Backhand-back-up.')
  if (typeof data.schemaVersion !== 'number' || data.schemaVersion > SCHEMA_VERSION)
    throw new Error('Deze back-up komt van een nieuwere versie van Backhand.')
  return {
    app: 'pivotal',
    schemaVersion: data.schemaVersion,
    exportedAt: typeof data.exportedAt === 'string' ? data.exportedAt : '',
    teams: rows(data, 'teams', ['id', 'name']) as unknown as Team[],
    players: rows(data, 'players', ['id', 'teamId', 'name']) as unknown as Player[],
    matches: rows(data, 'matches', ['id', 'homeTeamId', 'awayTeamId', 'date']) as unknown as Match[],
    actions: rows(data, 'actions', ['id', 'matchId', 'teamId', 'playerId', 'type']) as unknown as Action[],
  }
}

/** Replaces everything in the database with the backup, atomically. */
export async function restoreBackup(db: PivotalDB, backup: Backup) {
  await db.transaction('rw', db.teams, db.players, db.matches, db.actions, async () => {
    await Promise.all([
      db.teams.clear(),
      db.players.clear(),
      db.matches.clear(),
      db.actions.clear(),
    ])
    await db.teams.bulkAdd(backup.teams)
    await db.players.bulkAdd(backup.players)
    await db.matches.bulkAdd(backup.matches)
    await db.actions.bulkAdd(backup.actions)
  })
}

export function backupFileName(now = new Date()) {
  const p = (n: number) => String(n).padStart(2, '0')
  return `backhand-backup-${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}.json`
}
