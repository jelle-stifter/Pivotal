import type { Action } from '../types'

/** Always 2 halves of 30 minutes. */
export const HALF_MS = 30 * 60_000
export const PENALTY_MS = 2 * 60_000

// Open customer questions: the defaults are chosen here, one constant each.
/** TODO klantvraag 1: wissels tijdens de wedstrijd bijhouden? Standaard: nee. */
export const TRACK_SUBSTITUTIONS = false
/** TODO klantvraag 2: straftijd als gespeelde minuten of als kloktijd? Standaard: gespeelde minuten. */
export const PENALTY_TIME_DISPLAY: 'played' | 'clock' = 'played'
/** TODO klantvraag 3: loopt een straf vlak voor het einde van een helft door? Standaard: ja. */
export const PENALTY_CARRIES_OVER = true

/**
 * `Match.clockMs` is the game time played so far, continuous over the halves
 * (half 2 starts at 30:00). These helpers turn it into the per-half countdown.
 */
export function periodStartMs(period: number): number {
  return (Math.max(1, period) - 1) * HALF_MS
}

/** Time played in the current half, 0..HALF_MS. */
export function elapsedInHalf(gameMs: number, period: number): number {
  return Math.min(HALF_MS, Math.max(0, gameMs - periodStartMs(period)))
}

/** The half is over: the clock reached 0:00 and stays stopped. */
export function halfEnded(gameMs: number, period: number): boolean {
  return gameMs - periodStartMs(period) >= HALF_MS
}

/** What the big clock shows: counts down from 30:00; after 0:00 it jumps back to 30:00. */
export function countdownMs(gameMs: number, period: number): number {
  if (halfEnded(gameMs, period)) return HALF_MS
  return HALF_MS - elapsedInHalf(gameMs, period)
}

/** Game time never runs past the end of the current half. */
export function capGameMs(gameMs: number, period: number): number {
  return Math.min(gameMs, periodStartMs(period) + HALF_MS)
}

/** Clock value when switching half; the clock is paused at 30:00 of the new half. */
export function periodChange(
  period: number,
  delta: 1 | -1,
  periods = 2,
): { period: number; clockMs: number } | null {
  const next = period + delta
  if (next < 1 || next > periods) return null
  return { period: next, clockMs: periodStartMs(next) }
}

export interface ActivePenalty {
  actionId: string
  teamId: string
  playerId: string
  staffId?: string
  period: number
  startMs: number
  endMs: number
  remainingMs: number
}

/**
 * Running 2-minute suspensions. The timer is the game clock, so it stands
 * still when the clock stands still. `nowMs` is the (capped) game time.
 */
export function activePenalties(
  actions: Pick<
    Action,
    'id' | 'type' | 'teamId' | 'playerId' | 'staffId' | 'period' | 'matchClockMs' | 'createdAt'
  >[],
  nowMs: number,
  carryOver = PENALTY_CARRIES_OVER,
): ActivePenalty[] {
  const out: ActivePenalty[] = []
  for (const a of actions) {
    if (a.type !== 'suspension') continue
    const full = a.matchClockMs + PENALTY_MS
    const endMs = carryOver ? full : Math.min(full, periodStartMs(a.period) + HALF_MS)
    const remainingMs = endMs - nowMs
    if (remainingMs <= 0) continue
    out.push({
      actionId: a.id,
      teamId: a.teamId,
      playerId: a.playerId,
      staffId: a.staffId,
      period: a.period,
      startMs: a.matchClockMs,
      endMs,
      remainingMs,
    })
  }
  return out.sort((a, b) => a.endMs - b.endMs)
}

function mmss(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

/** "uit 6:10, terug 8:10, nog 1:30" (as played minutes, or as clock time). */
export function formatPenaltyTimes(
  p: Pick<ActivePenalty, 'startMs' | 'endMs' | 'remainingMs'>,
  mode: 'played' | 'clock' = PENALTY_TIME_DISPLAY,
): string {
  const point = (ms: number) => {
    if (mode === 'played') return mmss(ms)
    // Clock time: what the countdown showed (or will show) in that half.
    const half = Math.min(Math.floor(ms / HALF_MS), 1)
    return mmss(HALF_MS - (ms - half * HALF_MS))
  }
  return `uit ${point(p.startMs)}, terug ${point(p.endMs)}, nog ${mmss(p.remainingMs)}`
}

/** What the coach last asked the clock to do: running since `startedAt`, on top of `base`. */
export interface ClockIntent {
  base: number
  startedAt: number
}

/**
 * The clock must only stop by hand (Stop, Timeout, end of half, end of match).
 * If it is stopped by something else (e.g. an older copy from the server
 * overwrote the match), this returns the patch that starts it again exactly
 * where it would be now. Null = nothing to fix.
 */
export function clockRestorePatch(
  intent: ClockIntent | null,
  current: { clockMs: number; clockStartedAt: number | undefined; finishedAt?: number },
): { clockMs: number; clockStartedAt: number } | null {
  if (!intent || current.finishedAt) return null
  if (current.clockStartedAt !== undefined && current.clockStartedAt !== null) return null
  return { clockMs: intent.base, clockStartedAt: intent.startedAt }
}
