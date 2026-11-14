import { describe, expect, it } from 'vitest'
import {
  HALF_MS,
  PENALTY_MS,
  activePenalties,
  capGameMs,
  countdownMs,
  elapsedInHalf,
  formatPenaltyTimes,
  halfEnded,
  periodChange,
  periodStartMs,
} from './clock'

const MIN = 60_000

describe('half clock', () => {
  it('counts down from 30:00 in the first half', () => {
    expect(countdownMs(0, 1)).toBe(HALF_MS)
    expect(countdownMs(10 * MIN, 1)).toBe(20 * MIN)
    expect(countdownMs(HALF_MS - 1000, 1)).toBe(1000)
  })
  it('jumps back to 30:00 when the half is over and stays there', () => {
    expect(halfEnded(HALF_MS, 1)).toBe(true)
    expect(countdownMs(HALF_MS, 1)).toBe(HALF_MS)
    expect(countdownMs(HALF_MS + 5000, 1)).toBe(HALF_MS)
  })
  it('half 2 starts at 30:00 of the same continuous game time', () => {
    expect(periodStartMs(2)).toBe(HALF_MS)
    expect(elapsedInHalf(HALF_MS + 90_000, 2)).toBe(90_000)
    expect(countdownMs(HALF_MS + 90_000, 2)).toBe(HALF_MS - 90_000)
    expect(halfEnded(HALF_MS + 10, 2)).toBe(false)
  })
  it('never runs past the end of the current half', () => {
    expect(capGameMs(HALF_MS + 4000, 1)).toBe(HALF_MS)
    expect(capGameMs(12 * MIN, 1)).toBe(12 * MIN)
  })
  it('plus goes to the 2nd half, minus back; the end positions are blocked', () => {
    expect(periodChange(1, 1)).toEqual({ period: 2, clockMs: HALF_MS })
    expect(periodChange(2, -1)).toEqual({ period: 1, clockMs: 0 })
    expect(periodChange(2, 1)).toBeNull()
    expect(periodChange(1, -1)).toBeNull()
  })
  it('a changed half is paused at a full 30:00 countdown', () => {
    const c = periodChange(1, 1)!
    expect(countdownMs(c.clockMs, c.period)).toBe(HALF_MS)
    expect(halfEnded(c.clockMs, c.period)).toBe(false)
  })
})

describe('2-minute suspensions', () => {
  const susp = (id: string, at: number, period = 1) => ({
    id,
    type: 'suspension' as const,
    teamId: 't',
    playerId: id,
    period,
    matchClockMs: at,
    createdAt: at,
  })

  it('lists a running suspension with the time left', () => {
    const [p] = activePenalties([susp('12', 6 * MIN + 10_000)], 6 * MIN + 40_000)
    expect(p.startMs).toBe(6 * MIN + 10_000)
    expect(p.endMs).toBe(8 * MIN + 10_000)
    expect(p.remainingMs).toBe(PENALTY_MS - 30_000)
  })
  it('stands still when the clock stands still (same game time = same remaining)', () => {
    const a = activePenalties([susp('12', 6 * MIN)], 7 * MIN)
    const b = activePenalties([susp('12', 6 * MIN)], 7 * MIN)
    expect(a[0].remainingMs).toBe(b[0].remainingMs)
    expect(a[0].remainingMs).toBe(MIN)
  })
  it('drops a suspension that is over and ignores other actions', () => {
    const other = { ...susp('9', 0), type: 'yellow_card' as const }
    expect(activePenalties([susp('12', 0), other], 2 * MIN)).toEqual([])
    expect(activePenalties([other], 0)).toEqual([])
  })
  it('carries over into the next half by default', () => {
    const at = HALF_MS - 30_000
    const now = HALF_MS + 30_000 // second half, 0:30 played
    const [p] = activePenalties([susp('5', at)], now)
    expect(p.remainingMs).toBe(PENALTY_MS - 60_000)
  })
  it('can be switched off: the suspension ends with the half', () => {
    const at = HALF_MS - 30_000
    expect(activePenalties([susp('5', at)], HALF_MS - 10_000, false)[0].endMs).toBe(HALF_MS)
    expect(activePenalties([susp('5', at)], HALF_MS, false)).toEqual([])
  })
  it('sorts by the moment the player may return', () => {
    const list = activePenalties([susp('late', 4 * MIN), susp('early', 3 * MIN)], 4 * MIN + 30_000)
    expect(list.map((p) => p.playerId)).toEqual(['early', 'late'])
  })
  it('formats as played minutes: uit, terug, nog', () => {
    const [p] = activePenalties([susp('12', 6 * MIN + 10_000)], 6 * MIN + 40_000)
    expect(formatPenaltyTimes(p, 'played')).toBe('uit 6:10, terug 8:10, nog 1:30')
  })
  it('can also format as clock time', () => {
    const [p] = activePenalties([susp('12', 6 * MIN + 10_000)], 6 * MIN + 40_000)
    expect(formatPenaltyTimes(p, 'clock')).toBe('uit 23:50, terug 21:50, nog 1:30')
  })
})

import { clockRestorePatch } from './clock'

describe('clockRestorePatch (the clock only stops by hand)', () => {
  const intent = { base: 1000, startedAt: 5000 }
  it('restarts a clock that was stopped by something else (e.g. a sync overwrite)', () => {
    expect(clockRestorePatch(intent, { clockMs: 0, clockStartedAt: undefined })).toEqual({
      clockMs: 1000,
      clockStartedAt: 5000,
    })
  })
  it('does nothing after a manual stop (no intent), while running, or when finished', () => {
    expect(clockRestorePatch(null, { clockMs: 0, clockStartedAt: undefined })).toBeNull()
    expect(clockRestorePatch(intent, { clockMs: 0, clockStartedAt: 5000 })).toBeNull()
    expect(clockRestorePatch(intent, { clockMs: 0, clockStartedAt: undefined, finishedAt: 9 })).toBeNull()
  })
})
