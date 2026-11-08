import type { Point } from './court'

/**
 * Gaussian-kernel density on a cols x rows grid over the unit court.
 * Returns grid[row][col], normalized so the maximum is 1 (all zeros when
 * there are no valid points). `sigma` is in grid cells (1 cell = 1 m).
 */
export function heatGrid(
  points: Point[],
  cols = 40,
  rows = 20,
  sigma = 2,
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
