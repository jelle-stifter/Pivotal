import { describe, expect, it } from 'vitest'
import {
  addStaff,
  cleanPenaltyTakers,
  playingPlayers,
  removeStaff,
  setAbsence,
  setPenaltyTaker,
  updateStaff,
} from './prep'
import type { Player } from '../types'

const p = (id: string, number: number): Player => ({
  id,
  teamId: 't',
  name: id,
  number,
  position: '',
  isGoalkeeper: false,
  schemaVersion: 2,
})

describe('absence', () => {
  it('marks a player absent with a reason and back to playing', () => {
    const a = setAbsence(undefined, 'p1', 'blessure')
    expect(a).toEqual({ p1: 'blessure' })
    expect(setAbsence(a, 'p2', 'afwezig')).toEqual({ p1: 'blessure', p2: 'afwezig' })
    expect(setAbsence(a, 'p1', null)).toEqual({})
  })
  it('does not change the input', () => {
    const a = { p1: 'afwezig' as const }
    setAbsence(a, 'p1', null)
    expect(a).toEqual({ p1: 'afwezig' })
  })
  it('playing players = everyone not marked absent', () => {
    const players = [p('a', 1), p('b', 2), p('c', 3)]
    expect(playingPlayers({ absent: { b: 'niet_in_selectie' } }, players).map((x) => x.id)).toEqual(['a', 'c'])
    expect(playingPlayers({}, players)).toHaveLength(3)
  })
})

describe('top 3 penalty takers', () => {
  it('fills the slots in order', () => {
    let t = setPenaltyTaker(undefined, 0, 'a')
    t = setPenaltyTaker(t, 1, 'b')
    t = setPenaltyTaker(t, 2, 'c')
    expect(t).toEqual(['a', 'b', 'c'])
  })
  it('a player can only be listed once (he moves)', () => {
    expect(setPenaltyTaker(['a', 'b', 'c'], 0, 'c')).toEqual(['c', 'b'])
  })
  it('clearing a slot closes the gap', () => {
    expect(setPenaltyTaker(['a', 'b', 'c'], 1, '')).toEqual(['a', 'c'])
  })
  it('never keeps more than 3', () => {
    expect(setPenaltyTaker(['a', 'b', 'c'], 2, 'd')).toEqual(['a', 'b', 'd'])
  })
  it('absent players drop out of the list', () => {
    expect(cleanPenaltyTakers(['a', 'b', 'c'], { b: 'blessure' })).toEqual(['a', 'c'])
    expect(cleanPenaltyTakers(undefined, undefined)).toEqual([])
  })
})

describe('staff', () => {
  it('adds, renames, changes the role and removes', () => {
    let s = addStaff(undefined, '  Kees ', 'Eerste trainer', 's1')
    expect(s).toEqual([{ id: 's1', name: 'Kees', role: 'Eerste trainer' }])
    s = addStaff(s, 'Anja', '', 's2')
    expect(s[1].role).toBe('Overig')
    s = updateStaff(s, 's2', { role: 'Assistent' })
    expect(s[1]).toMatchObject({ name: 'Anja', role: 'Assistent' })
    s = removeStaff(s, 's1')
    expect(s.map((x) => x.id)).toEqual(['s2'])
  })
  it('ignores an empty name', () => {
    expect(addStaff([], '   ', 'Assistent', 'x')).toEqual([])
  })
})

import { validateOpponentInput } from './prep'

describe('validateOpponentInput', () => {
  it('accepts a new number and normalizes the position', () => {
    expect(validateOpponentInput([1, 2], '6', 'lo')).toEqual({ ok: true, number: 6, position: 'Links opbouw' })
    expect(validateOpponentInput([], '0')).toMatchObject({ ok: true, number: 0, position: '' })
  })
  it('gives a reason for every kind of wrong input', () => {
    const err = (...a: Parameters<typeof validateOpponentInput>) => {
      const r = validateOpponentInput(...a)
      return r.ok ? '' : r.error
    }
    expect(err([], '')).toBe('Vul een rugnummer in.')
    expect(err([], 'abc')).toBe('Rugnummer moet een getal zijn.')
    expect(err([], '-3')).toBe('Rugnummer moet een getal zijn.')
    expect(err([], '1.5')).toBe('Rugnummer moet een getal zijn.')
    expect(err([], '100')).toBe('Rugnummer moet tussen 0 en 99 liggen.')
    expect(err([6], '6')).toBe('Speler 6 is al ingevoerd.')
    expect(err([], '5', 'xyz')).toContain('Onbekende positie')
  })
})
