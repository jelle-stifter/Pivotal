import { useEffect } from 'react'

/** Keeps the screen on while `active` (so the phone does not lock during a match). */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return
    let lock: WakeLockSentinel | null = null
    let alive = true

    const request = async () => {
      try {
        lock = await navigator.wakeLock.request('screen')
        if (!alive) void lock.release()
      } catch {
        // Not allowed (battery saver, background tab): the screen may lock as usual.
      }
    }
    // The lock is released when the tab is hidden; take it again when it is back.
    const onVisible = () => {
      if (document.visibilityState === 'visible') void request()
    }
    void request()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      alive = false
      document.removeEventListener('visibilitychange', onVisible)
      void lock?.release().catch(() => undefined)
    }
  }, [active])
}
