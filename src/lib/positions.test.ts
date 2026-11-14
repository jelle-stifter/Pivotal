import { describe, expect, it } from 'vitest'
import { normalizePosition } from './positions'

describe('normalizePosition', () => {
  it('treats abbreviation and full name, in any case, as the same', () => {
    for (const v of ['rechts hoek', 'RH', 'rh', 'Rechts Hoek', ' RECHTSHOEK ']) {
      expect(normalizePosition(v)).toEqual({ ok: true, position: 'Rechts Hoek', code: 'RH' })
    }
    expect(normalizePosition('br')).toEqual({ ok: true, position: 'Break', code: 'Br' })
    expect(normalizePosition('2e cirkel')).toEqual({ ok: true, position: '2e Cirkel', code: 'CC' })
    expect(normalizePosition('doelman')).toMatchObject({ code: 'K' })
  })
  it('accepts empty input (no position)', () => {
    expect(normalizePosition('  ')).toEqual({ ok: true, position: '' })
  })
  it('gives a clear error for an unknown value', () => {
    const r = normalizePosition('linksbuiten')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toContain('Onbekende positie "linksbuiten"')
  })
})
