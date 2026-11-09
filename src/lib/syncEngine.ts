import { liveQuery } from 'dexie'
import { db, type OutboxEntry } from '../db/schema'
import type { Match } from '../types'
import { myMemberships, type Membership } from './cloud'
import { loadMemberships } from './membershipCache'
import { supabase } from './supabase'
import { deleteIds, fail, pullAll, sb, upsertAll } from './sync'

/**
 * Automatic sync (step 3).
 *
 * Upload: every local change is queued in the `outbox` table (see schema.ts)
 * and sent when there is internet. Offline scoring just keeps queueing.
 * Download: now and then the changes of your teams are fetched.
 * Both run in one cycle, never at the same time.
 */

export interface SyncStatus {
  state: 'idle' | 'syncing' | 'offline' | 'error'
  /** Local changes not yet uploaded. */
  pending: number
  lastSyncAt: number | null
  message: string
}

let status: SyncStatus = { state: 'idle', pending: 0, lastSyncAt: null, message: '' }
const listeners = new Set<() => void>()

export function getSyncStatus(): SyncStatus {
  return status
}

export function subscribeSyncStatus(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

function setStatus(patch: Partial<SyncStatus>) {
  status = { ...status, ...patch }
  listeners.forEach((fn) => fn())
}

const CYCLE_MS = 15_000
const FULL_PULL_EVERY = 10

/** "Not allowed" or "invalid" (Postgres class 42/23/22): retrying never helps. */
function isPermanent(e: unknown): boolean {
  const code = (e as { code?: string }).code
  return typeof code === 'string' && /^(42|23|22)/.test(code)
}

/** Sends the queued local changes. Throws on network problems (retry later). */
async function flush(uid: string, memberships: Membership[]): Promise<number> {
  const entries = await db.outbox.toArray()
  if (entries.length === 0) return 0

  const approved = memberships.filter((m) => m.status === 'approved')
  const online = new Set(approved.map((m) => m.teamId))
  const staff = new Set(approved.filter((m) => m.role !== 'player').map((m) => m.teamId))
  const matches = new Map((await db.matches.toArray()).map((m) => [m.id, m]))
  const nowIso = new Date().toISOString()

  const isMine = (m: Match) => online.has(m.homeTeamId) || online.has(m.awayTeamId)
  const isStaffOf = (m: Match) => staff.has(m.homeTeamId) || staff.has(m.awayTeamId)
  const opponentIds = new Set<string>()
  for (const m of matches.values()) {
    if (!isMine(m) || !isStaffOf(m)) continue
    for (const id of [m.homeTeamId, m.awayTeamId]) if (!online.has(id)) opponentIds.add(id)
  }

  const done: OutboxEntry[] = []
  let dropped = 0
  let lastDropMessage = ''

  /** Runs `send` for the batch; on "not allowed", retries one by one and drops the refused rows. */
  async function attempt(batch: OutboxEntry[], send: (rows: OutboxEntry[]) => Promise<void>) {
    if (batch.length === 0) return
    try {
      await send(batch)
      done.push(...batch)
    } catch (e) {
      if (!isPermanent(e)) throw e
      for (const one of batch) {
        try {
          await send([one])
        } catch (e2) {
          if (!isPermanent(e2)) throw e2
          dropped++
          lastDropMessage = e2 instanceof Error ? e2.message : 'niet toegestaan'
        }
        done.push(one)
      }
    }
  }

  const of = (table: OutboxEntry['table'], op: OutboxEntry['op']) =>
    entries.filter((e) => e.table === table && e.op === op)

  // Teams: opponents of my matches are created; my own teams are renamed.
  await attempt(of('teams', 'put'), async (rows) => {
    const teams = (await db.teams.bulkGet(rows.map((r) => r.id))).filter((t) => t !== undefined)
    const opp = teams.filter((t) => opponentIds.has(t.id))
    await upsertAll(
      'teams',
      opp.map((t) => ({ id: t.id, name: t.name, created_by: uid })),
    )
    for (const t of teams.filter((x) => online.has(x.id))) {
      fail((await sb().from('teams').update({ name: t.name }).eq('id', t.id)).error)
    }
  })

  // Players of my teams (staff only) and of opponents.
  await attempt(of('players', 'put'), async (rows) => {
    const players = (await db.players.bulkGet(rows.map((r) => r.id))).filter((p) => p !== undefined)
    const mine = players.filter((p) => staff.has(p.teamId) || opponentIds.has(p.teamId))
    await upsertAll(
      'players',
      mine.map((p) => ({ id: p.id, team_id: p.teamId, data: p, updated_at: nowIso })),
    )
  })

  // Matches: staff create/replace them (incl. the chosen scorer); a scorer only updates.
  await attempt(of('matches', 'put'), async (rows) => {
    const list = rows.map((r) => matches.get(r.id)).filter((m): m is Match => m !== undefined && isMine(m))
    const byStaff = list.filter(isStaffOf)
    // Opponent team + players must exist online before the match refers to them.
    const oppTeams = new Set<string>()
    for (const m of byStaff)
      for (const id of [m.homeTeamId, m.awayTeamId]) if (!online.has(id)) oppTeams.add(id)
    if (oppTeams.size > 0) {
      const t = await db.teams.bulkGet([...oppTeams])
      await upsertAll(
        'teams',
        t.filter((x) => x !== undefined).map((x) => ({ id: x.id, name: x.name, created_by: uid })),
      )
      const p = await db.players.where('teamId').anyOf([...oppTeams]).toArray()
      await upsertAll(
        'players',
        p.map((x) => ({ id: x.id, team_id: x.teamId, data: x, updated_at: nowIso })),
      )
    }
    await upsertAll(
      'matches',
      byStaff.map((m) => ({
        id: m.id,
        home_team_id: m.homeTeamId,
        away_team_id: m.awayTeamId,
        scorer_id: m.scorerId ?? null,
        data: m,
        updated_at: nowIso,
      })),
    )
    for (const m of list.filter((x) => !isStaffOf(x))) {
      fail((await sb().from('matches').update({ data: m, updated_at: nowIso }).eq('id', m.id)).error)
    }
  })

  // Actions (the live statistics).
  await attempt(of('actions', 'put'), async (rows) => {
    const actions = (await db.actions.bulkGet(rows.map((r) => r.id))).filter((a) => a !== undefined)
    const mine = actions.filter((a) => {
      const m = matches.get(a.matchId)
      return m !== undefined && isMine(m)
    })
    await upsertAll(
      'actions',
      mine.map((a) => ({ id: a.id, match_id: a.matchId, team_id: a.teamId, data: a, updated_at: nowIso })),
    )
  })

  // Deletions: children first. The server only deletes what the account may delete.
  for (const table of ['actions', 'matches', 'players'] as const) {
    await attempt(of(table, 'delete'), async (rows) => {
      await deleteIds(
        table,
        rows.map((r) => r.id),
      )
    })
  }
  // Teams are never deleted online by this automatic sync.
  done.push(...of('teams', 'delete'))

  // Clear what was sent, but keep rows that changed again in the meantime.
  await db.transaction('rw', db.outbox, async () => {
    for (const e of done) {
      const current = await db.outbox.get(e.key)
      if (current && current.at === e.at) await db.outbox.delete(e.key)
    }
  })

  if (dropped > 0) {
    setStatus({ message: `${dropped} wijziging(en) niet toegestaan en overgeslagen: ${lastDropMessage}` })
  }
  return done.length
}

let trigger: (() => void) | null = null

/** Run a sync cycle right now (button "Nu synchroniseren"). */
export function syncNow() {
  trigger?.()
}

/** Starts the sync loop; returns a stop function. Call once while logged in. */
export function startSyncEngine(): () => void {
  if (!supabase) return () => undefined

  let stopped = false
  let running = false
  let rerun = false
  let cursor: string | undefined
  let cycleNo = 0

  async function cycle() {
    if (stopped) return
    if (running) {
      rerun = true
      return
    }
    running = true
    try {
      if (!navigator.onLine) {
        setStatus({ state: 'offline', pending: await db.outbox.count() })
        return
      }
      setStatus({ state: 'syncing', message: '' })
      const memberships = await myMemberships()
      const uid = loadMemberships().uid
      if (!uid || !memberships.some((m) => m.status === 'approved')) {
        setStatus({ state: 'idle', pending: 0 })
        return
      }
      await flush(uid, memberships)
      const pending = await db.outbox.count()
      if (pending === 0) {
        const playerOnly = memberships
          .filter((m) => m.role === 'player' && m.status === 'approved')
          .map((m) => m.teamId)
        cycleNo++
        const full = cursor === undefined || cycleNo % FULL_PULL_EVERY === 0
        const r = await pullAll(playerOnly, full ? undefined : cursor)
        cursor = r.cursor ?? cursor
      }
      setStatus({ state: 'idle', pending: await db.outbox.count(), lastSyncAt: Date.now() })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Synchroniseren mislukt'
      // No network: keep everything queued and try again later.
      const offline = !navigator.onLine || /fetch|network|failed/i.test(msg)
      setStatus({
        state: offline ? 'offline' : 'error',
        pending: await db.outbox.count().catch(() => 0),
        message: offline ? '' : msg,
      })
    } finally {
      running = false
      if (rerun && !stopped) {
        rerun = false
        void cycle()
      }
    }
  }

  const timer = setInterval(() => {
    if (document.visibilityState === 'visible') void cycle()
  }, CYCLE_MS)
  const onOnline = () => void cycle()
  const onVisible = () => {
    if (document.visibilityState === 'visible') void cycle()
  }
  window.addEventListener('online', onOnline)
  document.addEventListener('visibilitychange', onVisible)

  // Upload soon after a local change (debounced).
  let debounce: ReturnType<typeof setTimeout> | undefined
  const sub = liveQuery(() => db.outbox.count()).subscribe({
    next: (n) => {
      setStatus({ pending: n })
      if (n > 0) {
        clearTimeout(debounce)
        debounce = setTimeout(() => void cycle(), 1500)
      }
    },
    error: () => undefined,
  })

  trigger = () => void cycle()
  void cycle()

  return () => {
    trigger = null
    stopped = true
    clearInterval(timer)
    clearTimeout(debounce)
    window.removeEventListener('online', onOnline)
    document.removeEventListener('visibilitychange', onVisible)
    sub.unsubscribe()
  }
}
