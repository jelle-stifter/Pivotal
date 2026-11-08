import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Cumulative match clock (handball: runs on across periods).
 * `get()` returns the exact current value, also between render ticks,
 * so actions are stamped with the true time.
 */
export function useMatchClock(
  initialMs: number,
  persist: (ms: number) => void,
) {
  const [ms, setMs] = useState(initialMs)
  const [running, setRunning] = useState(false)
  const baseRef = useRef(initialMs)
  const startRef = useRef(0)
  const runningRef = useRef(false)
  const persistRef = useRef(persist)
  persistRef.current = persist

  const get = useCallback(
    () =>
      runningRef.current
        ? baseRef.current + (performance.now() - startRef.current)
        : baseRef.current,
    [],
  )

  const start = useCallback(() => {
    if (runningRef.current) return
    startRef.current = performance.now()
    runningRef.current = true
    setRunning(true)
  }, [])

  const pause = useCallback(() => {
    if (!runningRef.current) return
    baseRef.current = get()
    runningRef.current = false
    setRunning(false)
    setMs(baseRef.current)
    persistRef.current(baseRef.current)
  }, [get])

  const toggle = useCallback(() => {
    if (runningRef.current) pause()
    else start()
  }, [pause, start])

  useEffect(() => {
    if (!running) return
    const tick = setInterval(() => setMs(get()), 200)
    const save = setInterval(() => persistRef.current(get()), 5000)
    return () => {
      clearInterval(tick)
      clearInterval(save)
    }
  }, [running, get])

  // Persist the final value when leaving the screen.
  useEffect(
    () => () => {
      persistRef.current(get())
    },
    [get],
  )

  return { ms, running, get, start, pause, toggle }
}
