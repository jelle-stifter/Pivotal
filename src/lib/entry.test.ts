import { describe, expect, it } from 'vitest'
import { resolveNumber } from './entry'
import { ACTION_META, keyToAction } from './actions'
import { ACTION_TYPES } from '../types'
import { editedClockMs, formatClock, parseClock } from './time'
import type { Player } from '../types'

const roster: Player[] = [1, 7, 10, 17].map((number) => ({
  id: `p${number}`,
  teamId: 'T',
  name: `P${number}`,
  number,
  position: '',
  isGoalkeeper: number === 1,
  schemaVersion: 1,
}))

describe('resolveNumber', () => {
  it('selects immediately when no longer number is possible', () => {
    const r = resolveNumber('7', roster)
    expect(r.player?.number).toBe(7)
    expect(r.pending).toBe(false)
  })
  it('waits when a longer number could follow', () => {
    const r = resolveNumber('1', roster)
    expect(r.player?.number).toBe(1)
    expect(r.pending).toBe(true)
  })
  it('resolves two digits', () => {
    const r = resolveNumber('17', roster)
    expect(r.player?.number).toBe(17)
    expect(r.pending).toBe(false)
  })
  it('flags an unknown number as invalid', () => {
    const r = resolveNumber('2', roster)
    expect(r.player).toBeNull()
    expect(r.pending).toBe(false)
  })
  it('tolerates a leading zero', () => {
    expect(resolveNumber('07', roster).player?.number).toBe(7)
  })
})

describe('keyToAction', () => {
  it('maps the documented keys, case-insensitive', () => {
    expect(keyToAction('g')).toBe('goal')
    expect(keyToAction('S')).toBe('shot')
    expect(keyToAction('t')).toBe('turnover')
    expect(keyToAction('v')).toBe('save')
    expect(keyToAction('i')).toBe('interception')
    expect(keyToAction('f')).toBe('foul')
    expect(keyToAction('q')).toBeUndefined()
  })
  it('maps the Lions 2 actions', () => {
    expect(keyToAction('a')).toBe('assist')
    expect(keyToAction('w')).toBe('penalty_won')
    expect(keyToAction('p')).toBe('bad_pass')
    expect(keyToAction('x')).toBe('technical_foul')
    expect(keyToAction('y')).toBe('yellow_card')
    expect(keyToAction('m')).toBe('suspension')
    expect(keyToAction('r')).toBe('red_card')
    expect(keyToAction('b')).toBe('blue_card')
  })
  it('maps Shift+G/S/V to the 7-meter variants', () => {
    expect(keyToAction('G', true)).toBe('penalty_goal')
    expect(keyToAction('S', true)).toBe('penalty_miss')
    expect(keyToAction('V', true)).toBe('penalty_saved')
    expect(keyToAction('A', true)).toBeUndefined()
  })
  it('never gives two actions the same plain key', () => {
    const keys = ACTION_TYPES.map((t) => ACTION_META[t].key)
    expect(new Set(keys).size).toBe(keys.length)
    // plain keys must not collide with reserved hotkeys (N = next period)
    for (const k of keys.filter((k) => k.length === 1)) expect(k).not.toBe('N')
  })
})

describe('clock formatting', () => {
  it('formats and parses mm:ss', () => {
    expect(formatClock(0)).toBe('00:00')
    expect(formatClock(61_500)).toBe('01:01')
    expect(formatClock(3_600_000)).toBe('60:00')
    expect(parseClock('12:34')).toBe(754_000)
    expect(parseClock('5:07')).toBe(307_000)
  })
  it('keeps the exact clock value when the edited text is unchanged', () => {
    expect(editedClockMs(18_586, '00:18')).toBe(18_586)
    expect(editedClockMs(18_586, ' 00:18 ')).toBe(18_586)
  })
  it('uses the typed time when it was changed, and rejects invalid text', () => {
    expect(editedClockMs(18_586, '00:20')).toBe(20_000)
    expect(editedClockMs(18_586, '99:99')).toBeNull()
  })
  it('rejects invalid input', () => {
    expect(parseClock('12:75')).toBeNull()
    expect(parseClock('abc')).toBeNull()
    expect(parseClock('')).toBeNull()
  })
})
