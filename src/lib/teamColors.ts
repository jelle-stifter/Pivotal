import type { Match } from '../types'
import { opponentTeamId } from './ownTeam'

/** Main colours (with a darker or lighter variant) offered when creating a match. */
export const TEAM_COLORS: { name: string; hex: string }[] = [
  { name: 'Rood', hex: '#dc2626' },
  { name: 'Donkerrood', hex: '#7f1d1d' },
  { name: 'Oranje', hex: '#ea580c' },
  { name: 'Geel', hex: '#eab308' },
  { name: 'Groen', hex: '#16a34a' },
  { name: 'Donkergroen', hex: '#14532d' },
  { name: 'Lichtblauw', hex: '#38bdf8' },
  { name: 'Blauw', hex: '#2563eb' },
  { name: 'Marineblauw', hex: '#1e3a8a' },
  { name: 'Paars', hex: '#7c3aed' },
  { name: 'Roze', hex: '#db2777' },
  { name: 'Zwart', hex: '#111827' },
  { name: 'Grijs', hex: '#6b7280' },
  { name: 'Wit', hex: '#f9fafb' },
]

/** Suggested colours for a new match: our own team blue, the opponent red. */
export const DEFAULT_OWN_HEX = '#2563eb'
export const DEFAULT_OPPONENT_HEX = '#dc2626'

/** Colours of older matches that have none chosen. */
const LEGACY_HOME = '#6b7280'
const LEGACY_AWAY = '#4b5563'

const isHex = (v: string | undefined): v is string => !!v && /^#[0-9a-fA-F]{6}$/.test(v)

function channels(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function luminance(hex: string): number {
  const [r, g, b] = channels(hex).map((c) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** WCAG contrast ratio, 1..21. */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/** Black or white, whichever reads best on this colour (always at least 4.5:1). */
export function textOn(hex: string): '#000000' | '#ffffff' {
  return contrastRatio(hex, '#000000') >= contrastRatio(hex, '#ffffff') ? '#000000' : '#ffffff'
}

/** A lighter variant of a colour (for lines and accents on dark backgrounds). */
export function lighten(hex: string, amount = 0.55): string {
  const [r, g, b] = channels(hex).map((c) => Math.round(c + (255 - c) * amount))
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

/** True when two colours are hard to tell apart (same or very close). */
export function colorsTooClose(a: string, b: string): boolean {
  const [r1, g1, b1] = channels(a)
  const [r2, g2, b2] = channels(b)
  return Math.hypot(r1 - r2, g1 - g2, b1 - b2) < 50
}

/**
 * Team colours of a match: the chosen ones, else (older matches) the old
 * opponent colour, else grey.
 */
export function matchColors(
  match: Pick<Match, 'homeColor' | 'awayColor' | 'opponentColor' | 'ownSide' | 'homeTeamId' | 'awayTeamId'>,
): { home: string; away: string } {
  const oppIsAway = opponentTeamId(match) === match.awayTeamId
  const legacyOpp = isHex(match.opponentColor) ? match.opponentColor : undefined
  return {
    home: isHex(match.homeColor) ? match.homeColor : (!oppIsAway && legacyOpp) || LEGACY_HOME,
    away: isHex(match.awayColor) ? match.awayColor : (oppIsAway && legacyOpp) || LEGACY_AWAY,
  }
}
