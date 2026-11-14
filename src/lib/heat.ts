import { teamAttacksRight, type Point } from './court'
import type { Match } from '../types'

/** Fine grid: 80 x 40 cells of half a metre (the court is 40 x 20 m). */
export const HEAT_COLS = 80
export const HEAT_ROWS = 40
/** Blur radius in cells (3 cells = 1.5 m). */
export const HEAT_SIGMA = 3

/**
 * Gaussian-kernel density on a cols x rows grid over the unit court.
 * Returns grid[row][col], normalized so the maximum is 1 (all zeros when
 * there are no valid points). `sigma` is in grid cells (1 cell = 0.5 m).
 */
export function heatGrid(
  points: Point[],
  cols = HEAT_COLS,
  rows = HEAT_ROWS,
  sigma = HEAT_SIGMA,
): number[][] {
  const grid = Array.from({ length: rows }, () => new Array<number>(cols).fill(0))
  const twoSigmaSq = 2 * sigma * sigma
  const reach = Math.ceil(sigma * 3)

  for (const p of points) {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue
    const px = Math.min(1, Math.max(0, p.x)) * cols
    const py = Math.min(1, Math.max(0, p.y)) * rows
    const c0 = Math.floor(Math.min(px, cols - 1e-9))
    const r0 = Math.floor(Math.min(py, rows - 1e-9))
    for (let r = Math.max(0, r0 - reach); r <= Math.min(rows - 1, r0 + reach); r++) {
      for (let c = Math.max(0, c0 - reach); c <= Math.min(cols - 1, c0 + reach); c++) {
        const dx = c + 0.5 - px
        const dy = r + 0.5 - py
        grid[r][c] += Math.exp(-(dx * dx + dy * dy) / twoSigmaSq)
      }
    }
  }

  let max = 0
  for (const row of grid) for (const v of row) if (v > max) max = v
  if (max > 0) for (const row of grid) for (let c = 0; c < cols; c++) row[c] /= max
  return grid
}

/**
 * Stored positions are attack-normalized (x = 1 is the goal the team shoots
 * at). To draw two teams on one court, a team that attacks to the left is
 * rotated 180 degrees (x AND y flip, like toNormalized in court.ts).
 */
export function toCourtFrame(p: Point, attacksRight: boolean): Point {
  return attacksRight ? { x: p.x, y: p.y } : { x: 1 - p.x, y: 1 - p.y }
}

export interface TeamHeat {
  teamId: string
  attacksRight: boolean
  /** Positions in the displayed court (own half of this team). */
  points: Point[]
  grid: number[][]
}

/**
 * One heat grid per team, each on its own half: the team that attacks right
 * is drawn at the right goal, the other one at the left goal. The home/away
 * flag of the match decides who is where (so HVM switches sides).
 */
export function heatByTeam(
  actions: { teamId: string; x: number; y: number }[],
  match: Pick<Match, 'homeTeamId' | 'awayTeamId' | 'homeAttacksRight'>,
): TeamHeat[] {
  return [match.homeTeamId, match.awayTeamId].map((teamId) => {
    const attacksRight = teamAttacksRight(match, teamId)
    const points = actions
      .filter((a) => a.teamId === teamId)
      .map((a) => toCourtFrame({ x: a.x, y: a.y }, attacksRight))
    return { teamId, attacksRight, points, grid: heatGrid(points) }
  })
}
