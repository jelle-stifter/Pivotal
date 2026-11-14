import { describe, expect, it } from 'vitest'
import { TEAM_COLORS, colorsTooClose, contrastRatio, matchColors, textOn } from './teamColors'

describe('textOn', () => {
  it('gives at least 4.5:1 contrast on every offered colour', () => {
    for (const c of TEAM_COLORS) {
      expect(contrastRatio(c.hex, textOn(c.hex))).toBeGreaterThanOrEqual(4.5)
    }
  })
  it('picks white on dark and black on light colours', () => {
    expect(textOn('#111827')).toBe('#ffffff')
    expect(textOn('#1e3a8a')).toBe('#ffffff')
    expect(textOn('#eab308')).toBe('#000000')
    expect(textOn('#f9fafb')).toBe('#000000')
  })
})

describe('colorsTooClose', () => {
  it('warns for the same or similar colours only', () => {
    expect(colorsTooClose('#dc2626', '#dc2626')).toBe(true)
    expect(colorsTooClose('#dc2626', '#ea580c')).toBe(false)
    expect(colorsTooClose('#2563eb', '#1e3a8a')).toBe(false)
    expect(colorsTooClose('#111827', '#1f2937')).toBe(true)
  })
})

describe('matchColors', () => {
  const base = { homeTeamId: 'H', awayTeamId: 'A' }
  it('uses the chosen colours', () => {
    expect(matchColors({ ...base, homeColor: '#2563eb', awayColor: '#dc2626' })).toEqual({
      home: '#2563eb',
      away: '#dc2626',
    })
  })
  it('falls back to the old opponent colour on the opponent side, else grey', () => {
    expect(matchColors({ ...base, ownSide: 'home', opponentColor: '#16a34a' }).away).toBe('#16a34a')
    expect(matchColors({ ...base, ownSide: 'away', opponentColor: '#16a34a' }).home).toBe('#16a34a')
    const none = matchColors(base)
    expect(none.home).not.toBe(none.away)
  })
})
