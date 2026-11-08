import { describe, expect, it } from 'vitest'
import {
  hasPosition,
  homeAttacksRight,
  teamAttacksRight,
  toNormalized,
} from './court'

describe('toNormalized', () => {
  it('keeps the click when the acting team attacks right', () => {
    expect(toNormalized({ x: 0.8, y: 0.3 }, true)).toEqual({ x: 0.8, y: 0.3 })
  })
  it('rotates 180 degrees (x and y flip) when the acting team attacks left', () => {
    const p = toNormalized({ x: 0.2, y: 0.25 }, false)
    expect(p.x).toBeCloseTo(0.8)
    expect(p.y).toBeCloseTo(0.75)
  })
  it('is its own inverse', () => {
    const once = toNormalized({ x: 0.1, y: 0.9 }, false)
    const twice = toNormalized(once, false)
    expect(twice.x).toBeCloseTo(0.1)
    expect(twice.y).toBeCloseTo(0.9)
  })
  it('clamps out-of-range clicks', () => {
    expect(toNormalized({ x: 1.4, y: -0.2 }, true)).toEqual({ x: 1, y: 0 })
  })
  it('puts a shot at the opponent goal at x=1 for both teams', () => {
    // home attacks right: a click near the right goal is x~1 for home
    expect(toNormalized({ x: 0.95, y: 0.5 }, true).x).toBeGreaterThan(0.9)
    // away attacks left: a click near the left goal is x~1 after normalizing
    expect(toNormalized({ x: 0.05, y: 0.5 }, false).x).toBeGreaterThan(0.9)
  })
})

describe('teamAttacksRight', () => {
  const m = { homeTeamId: 'H' }
  it('home attacks right by default (older matches)', () => {
    expect(homeAttacksRight({})).toBe(true)
    expect(teamAttacksRight({ ...m, homeAttacksRight: undefined }, 'H')).toBe(true)
    expect(teamAttacksRight({ ...m, homeAttacksRight: undefined }, 'A')).toBe(false)
  })
  it('flips for both teams after switching sides', () => {
    expect(teamAttacksRight({ ...m, homeAttacksRight: false }, 'H')).toBe(false)
    expect(teamAttacksRight({ ...m, homeAttacksRight: false }, 'A')).toBe(true)
  })
})

describe('hasPosition', () => {
  it('is false for actions without a position, so nothing crashes', () => {
    expect(hasPosition({})).toBe(false)
    expect(hasPosition({ x: 0.5 })).toBe(false)
    expect(hasPosition({ x: Number.NaN, y: 0.5 })).toBe(false)
  })
  it('is true for a valid position, including 0', () => {
    expect(hasPosition({ x: 0, y: 0 })).toBe(true)
    expect(hasPosition({ x: 0.4, y: 0.6 })).toBe(true)
  })
})
