import Dexie, { type EntityTable, type Table } from 'dexie'
import type { Action, Match, Player, Team } from '../types'
import { hasOnlineTeams } from '../lib/membershipCache'

export type SyncTable = 'teams' | 'players' | 'matches' | 'actions'

/** A local change that still has to be sent to the server. */
export interface OutboxEntry {
  /** `${table}:${id}`: the latest change of a row replaces the older one. */
  key: string
  table: SyncTable
  id: string
  op: 'put' | 'delete'
  at: number
}

/**
 * Transactions that apply data coming FROM the server. Their writes must not
 * be queued again for upload.
 */
export const remoteTransactions = new WeakSet<object>()

/** Swappable in tests; in the app: only track when this device has online teams. */
export const tracking = { enabled: hasOnlineTeams }

export class PivotalDB extends Dexie {
  teams!: EntityTable<Team, 'id'>
  players!: EntityTable<Player, 'id'>
  matches!: EntityTable<Match, 'id'>
  actions!: EntityTable<Action, 'id'>
  outbox!: EntityTable<OutboxEntry, 'key'>

  constructor(name = 'pivotal') {
    super(name)
    this.version(1).stores({
      teams: 'id, name',
      players: 'id, teamId, number',
      matches: 'id, date',
      actions: 'id, matchId, teamId, playerId, type, period, createdAt',
    })
    // Version 2: queue of local changes for the automatic sync.
    this.version(2).stores({
      outbox: 'key, table',
    })

    const track = (
      trans: object,
      table: SyncTable,
      id: unknown,
      op: OutboxEntry['op'],
    ) => {
      if (!tracking.enabled() || remoteTransactions.has(trans)) return
      // Queue after the change itself is committed.
      ;(trans as { on: (e: string, f: () => void) => void }).on('complete', () => {
        void this.outbox
          .put({ key: `${table}:${String(id)}`, table, id: String(id), op, at: Date.now() })
          .catch(() => undefined)
      })
    }

    for (const name of ['teams', 'players', 'matches', 'actions'] as const) {
      const table = this[name] as unknown as Table
      table.hook('creating', (primKey, obj, trans) => {
        track(trans, name, primKey ?? (obj as { id: string }).id, 'put')
      })
      table.hook('updating', (_mods, primKey, _obj, trans) => {
        track(trans, name, primKey, 'put')
      })
      table.hook('deleting', (primKey, _obj, trans) => {
        track(trans, name, primKey, 'delete')
      })
    }
  }
}

export const db = new PivotalDB()
