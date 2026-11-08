/** Format milliseconds as mm:ss (minutes may exceed 99). */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/**
 * Clock value to store after editing the "mm:ss" text of an action.
 * If the text still shows the original value, keep the exact original
 * (sub-second precision) instead of rounding it down to whole seconds.
 * Returns null when the text is invalid.
 */
export function editedClockMs(originalMs: number, text: string): number | null {
  if (text.trim() === formatClock(originalMs)) return originalMs
  return parseClock(text)
}

/** Parse "mm:ss" into milliseconds, or null when invalid. */
export function parseClock(text: string): number | null {
  const m = /^(\d+):([0-5]\d)$/.exec(text.trim())
  if (!m) return null
  return (Number(m[1]) * 60 + Number(m[2])) * 1000
}
