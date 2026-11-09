import type { Match, Side, Team } from '../types'

/** Our own team (HVM) is on this side; older matches have no flag: home. */
export function ownSide(match: Pick<Match, 'ownSide'>): Side {
  return match.ownSide ?? 'home'
}

export function ownTeamId(match: Pick<Match, 'ownSide' | 'homeTeamId' | 'awayTeamId'>): string {
  return ownSide(match) === 'home' ? match.homeTeamId : match.awayTeamId
}

export function opponentTeamId(
  match: Pick<Match, 'ownSide' | 'homeTeamId' | 'awayTeamId'>,
): string {
  return ownSide(match) === 'home' ? match.awayTeamId : match.homeTeamId
}

/** Short scoreboard name: the given one, or the first three letters. */
export function shortName(team: Pick<Team, 'name' | 'shortName'> | undefined): string {
  if (!team) return '?'
  const s = team.shortName?.trim()
  return s ? s : team.name.replace(/\s+/g, '').slice(0, 3).toUpperCase()
}

export const OWN_COLOR = { main: '#0f766e', accent: '#5eead4' }
/** Default colour of the opponent: orange. */
export const OPPONENT_COLOR = { main: '#e2711d', accent: '#fdba74' }

/** Lighter accent for an opponent colour chosen in the match form. */
export function opponentColors(hex: string | undefined): { main: string; accent: string } {
  if (!hex || !/^#[0-9a-fA-F]{6}$/.test(hex)) return OPPONENT_COLOR
  const n = parseInt(hex.slice(1), 16)
  const mix = (c: number) => Math.round(c + (255 - c) * 0.55)
  const r = mix((n >> 16) & 255)
  const g = mix((n >> 8) & 255)
  const b = mix(n & 255)
  return { main: hex, accent: `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}` }
}
