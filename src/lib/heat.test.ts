import { describe, expect, it } from 'vitest'
import { heatGrid } from './heat'

function peak(grid: number[][]) {
  let best = { r: 0, c: 0, v: -1 }
  grid.forEach((row, r) =>
    row.forEach((v, c) => {
      if (v > best.v) best = { r, c, v }
    }),
  )
  return best
}

describe('heatGrid', () => {
  it('returns an all-zero grid of the requested size for empty input', () => {
    const g = heatGrid([])
    expect(g).toHaveLength(40)
    expect(g[0]).toHaveLength(80)
    expect(g.flat().every((v) => v === 0)).toBe(true)
  })
  it('peaks in the cell that contains a single point', () => {
    // cell (col 20, row 10) has its centre at x=20.5/80, y=10.5/40
    const g = heatGrid([{ x: 20.5 / 80, y: 10.5 / 40 }])
    const p = peak(g)
    expect(p).toEqual({ r: 10, c: 20, v: 1 })
  })
  it('normalizes the maximum to exactly 1', () => {
    const g = heatGrid([
      { x: 0.2, y: 0.5 },
      { x: 0.22, y: 0.5 },
      { x: 0.9, y: 0.1 },
    ])
    expect(Math.max(...g.flat())).toBeCloseTo(1)
    expect(Math.min(...g.flat())).toBeGreaterThanOrEqual(0)
  })
  it('gives denser areas a higher value', () => {
    const g = heatGrid([
      { x: 0.25, y: 0.5 },
      { x: 0.25, y: 0.5 },
      { x: 0.75, y: 0.5 },
    ])
    expect(g[20][20]).toBeGreaterThan(g[20][60])
  })
  it('handles points on the edges without crashing', () => {
    const g = heatGrid([
      { x: 0, y: 0 },
      { x: 1, y: 1 },
    ])
    expect(Math.max(...g.flat())).toBeCloseTo(1)
  })
  it('ignores invalid points', () => {
    const g = heatGrid([{ x: Number.NaN, y: 0.5 }])
    expect(g.flat().every((v) => v === 0)).toBe(true)
  })
})

describe('heatGrid resolution', () => {
  it('uses cells of half a metre (finer than the old 1 m blocks)', () => {
    const g = heatGrid([{ x: 0.5, y: 0.5 }])
    expect(g).toHaveLength(40)
    expect(g[0]).toHaveLength(80)
    // 20 m wide / 40 rows = 0.5 m per row
    expect(20 / g.length).toBe(0.5)
  })
})

import { heatByTeam, toCourtFrame } from './heat'

describe('heatByTeam (each team on its own half)', () => {
  const match = { homeTeamId: 'H', awayTeamId: 'A' }
  const acts = [
    { teamId: 'H', x: 0.9, y: 0.2 },
    { teamId: 'A', x: 0.9, y: 0.2 },
  ]
  it('draws the home team at the right goal and the away team at the left goal', () => {
    const [h, a] = heatByTeam(acts, match)
    expect(h.attacksRight).toBe(true)
    expect(h.points[0]).toEqual({ x: 0.9, y: 0.2 })
    expect(a.attacksRight).toBe(false)
    expect(a.points[0].x).toBeCloseTo(0.1)
    expect(a.points[0].y).toBeCloseTo(0.8)
  })
  it('swaps the sides when the home team attacks left', () => {
    const [h, a] = heatByTeam(acts, { ...match, homeAttacksRight: false })
    expect(h.attacksRight).toBe(false)
    expect(h.points[0].x).toBeCloseTo(0.1)
    expect(a.attacksRight).toBe(true)
  })
  it('keeps the heat of one team out of the other half', () => {
    const [h, a] = heatByTeam([acts[0]], match)
    expect(h.points).toHaveLength(1)
    expect(a.points).toHaveLength(0)
    expect(a.grid.flat().every((v) => v === 0)).toBe(true)
  })
  it('toCourtFrame mirrors both axes for a team attacking left', () => {
    expect(toCourtFrame({ x: 1, y: 0 }, false)).toEqual({ x: 0, y: 1 })
  })
})
