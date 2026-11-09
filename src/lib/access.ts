import type { Match } from '../types'
import type { Membership } from './cloud'

/** 'score' = may use the live screen; 'view' = statistics only. */
export type Access = 'score' | 'view'

type MatchTeams = Pick<Match, 'homeTeamId' | 'awayTeamId' | 'scorerId'>

const approved = (m: Membership) => m.status === 'approved'
const isStaff = (m: Membership) => m.role === 'coach' || m.role === 'assistant'

/**
 * Who may score this match?
 *  - Not connected to an online team: everything stays as before (local app).
 *  - Coach/assistant of either team, a player with "mag scoren", or the scorer
 *    the coach picked for this match: 'score'.
 *  - Everyone else (a normal player): statistics only.
 */
export function matchAccess(
  match: MatchTeams,
  memberships: Membership[],
  uid: string | null,
): Access {
  const mine = memberships.filter(
    (m) => approved(m) && (m.teamId === match.homeTeamId || m.teamId === match.awayTeamId),
  )
  if (mine.length === 0) return 'score'
  if (mine.some((m) => isStaff(m) || m.canScore)) return 'score'
  if (uid && match.scorerId === uid) return 'score'
  return 'view'
}

/** True when this account is only a player everywhere (no staff or scoring rights). */
export function isViewerOnly(memberships: Membership[]): boolean {
  const ok = memberships.filter(approved)
  return ok.length > 0 && !ok.some((m) => isStaff(m) || m.canScore)
}

/** Is another account currently scoring (advisory lock)? */
export function liveLockedByOther(
  match: Pick<Match, 'liveBy' | 'liveByName' | 'liveAt' | 'clockStartedAt'>,
  uid: string | null,
  now: number,
  staleMs = 3 * 60_000,
): string | null {
  if (!uid || !match.liveBy || match.liveBy === uid) return null
  const fresh = match.clockStartedAt !== undefined || now - (match.liveAt ?? 0) < staleMs
  return fresh ? (match.liveByName ?? 'Iemand anders') : null
}
