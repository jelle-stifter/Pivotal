import type { Action, Match } from '../types'

export interface Point {
  x: number
  y: number
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n))

/**
 * Convert a raw click on the (screen-oriented) court into the stored
 * attack-normalized frame. A team attacking left is rotated 180 degrees
 * (x AND y flip) so left/right wing handedness stays correct.
 */
export function toNormalized(
  click: Point,
  actingTeamAttacksRight: boolean,
): Point {
  const x = clamp01(click.x)
  const y = clamp01(click.y)
  return actingTeamAttacksRight ? { x, y } : { x: 1 - x, y: 1 - y }
}

/** Missing flag (older matches) means the home team attacks right. */
export function homeAttacksRight(
  match: Pick<Match, 'homeAttacksRight'>,
): boolean {
  return match.homeAttacksRight ?? true
}

export function teamAttacksRight(
  match: Pick<Match, 'homeTeamId' | 'homeAttacksRight'>,
  teamId: string,
): boolean {
  return (teamId === match.homeTeamId) === homeAttacksRight(match)
}

export function hasPosition<T extends Pick<Action, 'x' | 'y'>>(
  a: T,
): a is T & { x: number; y: number } {
  return (
    typeof a.x === 'number' &&
    typeof a.y === 'number' &&
    Number.isFinite(a.x) &&
    Number.isFinite(a.y)
  )
}
