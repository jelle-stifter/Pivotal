import { describe, expect, it } from 'vitest'
import { reportScale } from './reportLayout'

describe('reportScale', () => {
  it('does not scale a short report', () => {
    expect(reportScale(10)).toBe(1)
  })
  it('scales down with many players but never below 0.55', () => {
    const s = reportScale(34)
    expect(s).toBeLessThan(1)
    expect(s).toBeGreaterThan(0.55)
    expect(reportScale(200)).toBe(0.55)
  })
})
