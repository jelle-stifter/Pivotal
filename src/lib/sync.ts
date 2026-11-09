import Dexie from 'dexie'
import { db, remoteTransactions } from '../db/schema'
import { SCHEMA_VERSION, type Action, type Match, type Player } from '../types'
import { loadMemberships } from './membershipCache'
import { supabase } from './supabase'

/**
 * Explicit, manual sync (steps 1 and 2):
 *  - pushTeam: staff mirrors the local data of one team to the server.
 *  - pullAll: any member downloads everything they may see.
 * Nothing runs automatically yet, so nothing is overwritten by surprise.
 */

const CHUNK = 500
const PAGE = 1000
export const IN_CHUNK = 100

/**
 * Matches I am scoring on THIS device right now: their running clock and
 * edits must not be overwritten by an (older) copy from the server.
 * A running clock that was merely copied from someone else does not count.
 */
export function matchesScoredHere(matches: Match[], uid: string | null): Set<string> {
  if (!uid) return new Set()
  return new Set(
    matches
      .filter((m) => m.clockStartedAt !== undefined && !m.finishedAt && m.liveBy === uid)
      .map((m) => m.id),
  )
}

/**
 * For a match I am scoring here, only the "who is scoring" fields may come in
 * from the server, and only when they are newer (another person took over).
 */
export function lockPatch(local: Match, remote: Match): Partial<Match> | null {
  if ((remote.liveAt ?? 0) <= (local.liveAt ?? 0) || remote.liveBy === local.liveBy) return null
  return { liveBy: remote.liveBy, liveByName: remote.liveByName, liveAt: remote.liveAt }
}

/** Fetch one match fresh from the server (before opening the live screen). */
export async function refreshMatch(matchId: string): Promise<void> {
  const { data, error } = await sb()
    .from('matches')
    .select('id, data, scorer_id')
    .eq('id', matchId)
    .maybeSingle()
  fail(error)
  if (!data) return
  const uid = loadMemberships().uid
  await db.transaction('rw', [db.matches, db.outbox], async () => {
    remoteTransactions.add(Dexie.currentTransaction as object)
    // A change of mine that is still waiting for upload wins.
    if (await db.outbox.get(`matches:${matchId}`)) return
    const remote = { ...(data.data as Match), scorerId: (data.scorer_id as string | null) ?? undefined }
    const local = await db.matches.get(matchId)
    if (local && matchesScoredHere([local], uid).has(matchId)) {
      const patch = lockPatch(local, remote)
      if (patch) await db.matches.update(matchId, patch)
      return
    }
    await db.matches.put(remote)
  })
}

export interface PushResult {
  players: number
  matches: number
  actions: number
}

export interface PullResult {
  /** Newest server timestamp seen; pass as `since` for an incremental pull. */
  cursor?: string
  teams: number
  players: number
  matches: number
  actions: number
}

export function sb() {
  if (!supabase) throw new Error('Online functies zijn niet ingesteld')
  return supabase
}

/** Throws; keeps the Postgres error code so callers can tell "not allowed" from "no network". */
export function fail(error: { message: string; code?: string } | null) {
  if (error) throw Object.assign(new Error(error.message), { code: error.code })
}

export function chunks<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

export async function fetchAll<T>(table: string, select: string, since?: string): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += PAGE) {
    let q = sb().from(table).select(select)
    if (since) q = q.gte('updated_at', since)
    const { data, error } = await q.order('id').range(from, from + PAGE - 1)
    fail(error)
    const rows = (data ?? []) as unknown as T[]
    out.push(...rows)
    if (rows.length < PAGE) break
  }
  return out
}

/** Ids of rows where `column` is one of `values` (paged, chunked). */
export async function fetchIdsIn(table: string, column: string, values: string[]): Promise<string[]> {
  const out: string[] = []
  for (const part of chunks(values, IN_CHUNK)) {
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await sb()
        .from(table)
        .select('id')
        .in(column, part)
        .order('id')
        .range(from, from + PAGE - 1)
      fail(error)
      const rows = (data ?? []) as unknown as { id: string }[]
      out.push(...rows.map((r) => r.id))
      if (rows.length < PAGE) break
    }
  }
  return out
}

export async function upsertAll(table: string, rows: object[]) {
  for (const part of chunks(rows, CHUNK)) {
    const { error } = await sb().from(table).upsert(part, { onConflict: 'id' })
    fail(error)
  }
}

export async function deleteIds(table: string, ids: string[]) {
  for (const part of chunks(ids, IN_CHUNK)) {
    const { error } = await sb().from(table).delete().in('id', part)
    fail(error)
  }
}

/**
 * Mirror one team to the server: add/update what exists locally and remove
 * what the coach deleted. Only for coach/assistant of that team.
 * onlineTeamIds = teams I am a member of (never overwritten as "opponent").
 */
export async function pushTeam(teamId: string, onlineTeamIds: Set<string>): Promise<PushResult> {
  const { data: userData } = await sb().auth.getUser()
  const uid = userData.user?.id
  if (!uid) throw new Error('Niet ingelogd')
  const now = new Date().toISOString()

  const team = await db.teams.get(teamId)
  if (!team) throw new Error('Dit team staat niet op dit apparaat')

  const players = await db.players.where('teamId').equals(teamId).toArray()
  const matches = (await db.matches.toArray()).filter(
    (m) => m.homeTeamId === teamId || m.awayTeamId === teamId,
  )
  const matchIds = matches.map((m) => m.id)
  const actions: Action[] = []
  for (const part of chunks(matchIds, IN_CHUNK)) {
    actions.push(...(await db.actions.where('matchId').anyOf(part).toArray()))
  }

  // Opponent teams (and their players, for names in the action lists).
  const opponentIds = new Set<string>()
  for (const m of matches) {
    for (const id of [m.homeTeamId, m.awayTeamId]) {
      if (id !== teamId && !onlineTeamIds.has(id)) opponentIds.add(id)
    }
  }
  const opponents = opponentIds.size ? await db.teams.where('id').anyOf([...opponentIds]).toArray() : []
  const opponentPlayers = opponentIds.size
    ? await db.players.where('teamId').anyOf([...opponentIds]).toArray()
    : []

  await upsertAll(
    'teams',
    opponents.map((t) => ({ id: t.id, name: t.name, created_by: uid, updated_at: now })),
  )
  // Own team: rename (only a coach may; an assistant simply changes 0 rows).
  fail((await sb().from('teams').update({ name: team.name, updated_at: now }).eq('id', teamId)).error)

  const playerRow = (p: Player) => ({ id: p.id, team_id: p.teamId, data: p, updated_at: now })
  await upsertAll('players', [...players, ...opponentPlayers].map(playerRow))
  await upsertAll(
    'matches',
    matches.map((m: Match) => ({
      id: m.id,
      home_team_id: m.homeTeamId,
      away_team_id: m.awayTeamId,
      data: m,
      updated_at: now,
    })),
  )
  await upsertAll(
    'actions',
    actions.map((a) => ({ id: a.id, match_id: a.matchId, team_id: a.teamId, data: a, updated_at: now })),
  )

  // Remove from the server what no longer exists locally. Strictly limited to
  // this team, its opponents and its matches, never to other online teams.
  const keepPlayers = new Set([...players, ...opponentPlayers].map((p) => p.id))
  const remotePlayers = await fetchIdsIn('players', 'team_id', [teamId, ...opponentIds])
  await deleteIds('players', remotePlayers.filter((id) => !keepPlayers.has(id)))

  const keepMatches = new Set(matchIds)
  const remoteMatches = new Set([
    ...(await fetchIdsIn('matches', 'home_team_id', [teamId])),
    ...(await fetchIdsIn('matches', 'away_team_id', [teamId])),
  ])
  await deleteIds('matches', [...remoteMatches].filter((id) => !keepMatches.has(id)))

  const keepActions = new Set(actions.map((a) => a.id))
  const remoteActions = await fetchIdsIn('actions', 'match_id', matchIds)
  await deleteIds('actions', remoteActions.filter((id) => !keepActions.has(id)))

  return { players: players.length, matches: matches.length, actions: actions.length }
}

/** Ids that exist on the server (what is left after deletions). */
export interface RemoteIds {
  players: Set<string>
  matches: Set<string>
  actions: Set<string>
}

/**
 * Removes local rows of the given (player-only) teams that no longer exist on
 * the server. Call inside a transaction that covers these tables + outbox.
 * Rows with a local change waiting for upload are left alone.
 */
export async function pruneLocal(teamIds: string[], remote: RemoteIds): Promise<void> {
  const own = new Set(teamIds)
  const pending = new Set((await db.outbox.toArray()).map((e) => e.key))
  const free = (table: string, id: string) => !pending.has(`${table}:${id}`)

  const localPlayers = await db.players.where('teamId').anyOf(teamIds).toArray()
  await db.players.bulkDelete(
    localPlayers.filter((p) => !remote.players.has(p.id) && free('players', p.id)).map((p) => p.id),
  )

  const localMatches = (await db.matches.toArray()).filter(
    (m) => own.has(m.homeTeamId) || own.has(m.awayTeamId),
  )
  const goneMatches = localMatches
    .filter((m) => !remote.matches.has(m.id) && free('matches', m.id))
    .map((m) => m.id)
  await db.matches.bulkDelete(goneMatches)
  await db.actions.where('matchId').anyOf(goneMatches).delete()

  const keptIds = localMatches.filter((m) => remote.matches.has(m.id)).map((m) => m.id)
  const localActions = await db.actions.where('matchId').anyOf(keptIds).toArray()
  await db.actions.bulkDelete(
    localActions.filter((a) => !remote.actions.has(a.id) && free('actions', a.id)).map((a) => a.id),
  )
}

/**
 * Cheap deletion check (only ids are fetched), run every sync round so that
 * something the coach deleted disappears for players within seconds.
 */
export async function pruneDeleted(playerOnlyTeamIds: string[]): Promise<void> {
  if (playerOnlyTeamIds.length === 0) return
  const [players, matches, actions] = await Promise.all([
    fetchAll<{ id: string }>('players', 'id'),
    fetchAll<{ id: string }>('matches', 'id'),
    fetchAll<{ id: string }>('actions', 'id'),
  ])
  await db.transaction('rw', [db.players, db.matches, db.actions, db.outbox], async () => {
    remoteTransactions.add(Dexie.currentTransaction as object)
    await pruneLocal(playerOnlyTeamIds, {
      players: new Set(players.map((r) => r.id)),
      matches: new Set(matches.map((r) => r.id)),
      actions: new Set(actions.map((r) => r.id)),
    })
  })
}

/**
 * Download everything this account may see. Never deletes on staff devices.
 * On devices where I am only a player of a team, rows that were removed on
 * the server are removed locally too.
 */
export async function pullAll(
  playerOnlyTeamIds: string[],
  /** Only rows changed since this server timestamp (no deletion check then). */
  since?: string,
): Promise<PullResult> {
  type Stamped = { updated_at: string }
  const [teams, players, matches, actions] = await Promise.all([
    fetchAll<{ id: string; name: string } & Stamped>('teams', 'id, name, updated_at', since),
    fetchAll<{ id: string; data: Player } & Stamped>('players', 'id, data, updated_at', since),
    fetchAll<{ id: string; data: Match; scorer_id: string | null } & Stamped>(
      'matches',
      'id, data, scorer_id, updated_at',
      since,
    ),
    fetchAll<{ id: string; data: Action } & Stamped>('actions', 'id, data, updated_at', since),
  ])
  const cursor = [...teams, ...players, ...matches, ...actions]
    .map((r) => r.updated_at)
    .reduce<string | undefined>((max, v) => (max === undefined || v > max ? v : max), since)

  await db.transaction('rw', [db.teams, db.players, db.matches, db.actions, db.outbox], async () => {
    // Writes below come from the server: do not queue them for upload.
    remoteTransactions.add(Dexie.currentTransaction as object)

    // Never overwrite a local change that has not been uploaded yet, nor the
    // match whose clock is running on this device.
    const pending = new Set((await db.outbox.toArray()).map((e) => e.key))
    const free = (table: string, id: string) => !pending.has(`${table}:${id}`)
    const runningHere = matchesScoredHere(await db.matches.toArray(), loadMemberships().uid)

    await db.teams.bulkPut(
      teams
        .filter((t) => free('teams', t.id))
        .map((t) => ({ id: t.id, name: t.name, schemaVersion: SCHEMA_VERSION })),
    )
    await db.players.bulkPut(players.filter((p) => free('players', p.id)).map((p) => p.data))
    await db.matches.bulkPut(
      matches
        .filter((m) => free('matches', m.id) && !runningHere.has(m.id))
        .map((m) => ({ ...m.data, scorerId: m.scorer_id ?? undefined })),
    )
    await db.actions.bulkPut(actions.filter((a) => free('actions', a.id)).map((a) => a.data))

    // A match I am scoring is not overwritten, but I do hear when someone takes over.
    for (const id of runningHere) {
      const remote = matches.find((m) => m.id === id)
      const local = await db.matches.get(id)
      const patch = remote && local ? lockPatch(local, remote.data) : null
      if (patch) await db.matches.update(id, patch)
    }

    if (playerOnlyTeamIds.length > 0 && !since) {
      await pruneLocal(playerOnlyTeamIds, {
        players: new Set(players.map((p) => p.id)),
        matches: new Set(matches.map((m) => m.id)),
        actions: new Set(actions.map((a) => a.id)),
      })
    }
  })

  return {
    cursor,
    teams: teams.length,
    players: players.length,
    matches: matches.length,
    actions: actions.length,
  }
}
