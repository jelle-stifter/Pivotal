import type { Player } from '../types'

/** Strip leading zeros so "07" selects shirt 7. */
export function normalizeBuffer(buffer: string): string {
  return buffer.replace(/^0+(?=\d)/, '')
}

export interface Resolution {
  /** Player whose shirt number equals the typed digits, if any. */
  player: Player | null
  /** True when a longer number could still follow (e.g. "1" with 10..19). */
  pending: boolean
}

/**
 * Resolve typed shirt-number digits against a roster.
 * - exact match and nothing longer possible -> select immediately
 * - exact match but longer numbers exist    -> wait (timeout/Enter confirms)
 * - no match and nothing longer possible    -> invalid number
 */
export function resolveNumber(buffer: string, players: Player[]): Resolution {
  const b = normalizeBuffer(buffer)
  const player = players.find((p) => String(p.number) === b) ?? null
  const pending = players.some((p) => {
    const s = String(p.number)
    return s !== b && s.startsWith(b)
  })
  return { player, pending }
}
