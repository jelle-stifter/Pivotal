import { useCallback, useEffect, useState } from 'react'

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
 */
export function useMatchClock(
  clockMs: number,
  clockStartedAt: number | undefined,
  update: (patch: ClockPatch) => void,
) {
  const running = clockStartedAt !== undefined && clockStartedAt !== null
  const [, tick] = useState(0)

  const get = useCallback(
    () => (running ? clockMs + (Date.now() - clockStartedAt) : clockMs),
    [running, clockMs, clockStartedAt],
  )

  const start = useCallback(() => {
    if (running) return
    update({ clockMs, clockStartedAt: Date.now() })
  }, [running, clockMs, update])

  const pause = useCallback(() => {
    if (!running) return
    update({ clockMs: Math.round(get()), clockStartedAt: undefined })
  }, [running, get, update])

  const toggle = useCallback(() => {
    if (running) pause()
    else start()
  }, [running, pause, start])

  useEffect(() => {
    if (!running) return
    const id = setInterval(() => tick((n) => n + 1), 200)
    return () => clearInterval(id)
  }, [running])

  return { ms: get(), running, get, start, pause, toggle }
}
