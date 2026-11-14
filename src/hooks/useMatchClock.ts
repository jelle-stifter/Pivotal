import { useCallback, useEffect, useRef, useState } from 'react'
import { clockRestorePatch, type ClockIntent } from '../lib/clock'

export interface ClockPatch {
  clockMs: number
  clockStartedAt: number | undefined
}

/**
 * Cumulative match clock (handball: runs on across periods).
 *
 * The state lives in the match record (`clockMs` + `clockStartedAt`), not in
 * this component. So the clock keeps running when the coach opens the
 * statistics or the match list, and after a reload. `get()` returns the exact
 * current value, also between render ticks.
 *
 * The clock only stops by hand: `pause()` (Stop button) or `release()` before
 * the screen stops it on purpose (end of half, timeout, end of match). Any
 * other stop (a sync overwriting the match) is undone straight away.
 */
export function useMatchClock(
  clockMs: number,
  clockStartedAt: number | undefined,
  update: (patch: ClockPatch) => void,
  finishedAt?: number,
) {
  const running = clockStartedAt !== undefined && clockStartedAt !== null
  const [, tick] = useState(0)
  const intent = useRef<ClockIntent | null>(null)

  const get = useCallback(
    () => (running ? clockMs + (Date.now() - clockStartedAt) : clockMs),
    [running, clockMs, clockStartedAt],
  )

  const start = useCallback(() => {
    if (running) return
    const startedAt = Date.now()
    intent.current = { base: clockMs, startedAt }
    update({ clockMs, clockStartedAt: startedAt })
  }, [running, clockMs, update])

  const pause = useCallback(() => {
    if (!running) return
    intent.current = null
    update({ clockMs: Math.round(get()), clockStartedAt: undefined })
  }, [running, get, update])

  /** Call right before stopping the clock on purpose from outside this hook. */
  const release = useCallback(() => {
    intent.current = null
  }, [])

  const toggle = useCallback(() => {
    if (running) pause()
    else start()
  }, [running, pause, start])

  // Remember a clock that is running (also one that was already running on open).
  useEffect(() => {
    if (running) intent.current = { base: clockMs, startedAt: clockStartedAt }
  }, [running, clockMs, clockStartedAt])

  // Undo a stop that nobody asked for.
  useEffect(() => {
    if (running) return
    const patch = clockRestorePatch(intent.current, { clockMs, clockStartedAt, finishedAt })
    if (patch) update(patch)
  }, [running, clockMs, clockStartedAt, finishedAt, update])

  useEffect(() => {
    if (!running) return
    const id = setInterval(() => tick((n) => n + 1), 200)
    return () => clearInterval(id)
  }, [running])

  return { ms: get(), running, get, start, pause, release, toggle }
}
