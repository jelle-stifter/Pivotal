import { describe, expect, it } from 'vitest'
import { missingFields, runningScores } from './history'

const a = (id: string, teamId: string, type: string, ms: number) =>
  ({ id, teamId, type, matchClockMs: ms, createdAt: ms }) as never

describe('runningScores', () => {
  it('gives the score after each action, in match order', () => {
    const list = [a('3', 'A', 'goal', 300), a('1', 'H', 'goal', 100), a('2', 'H', 'shot', 200), a('4', 'H', 'penalty_goal', 400)]
    const s = runningScores(list, 'H', 'A')
    expect(s.get('1')).toEqual({ home: 1, away: 0 })
    expect(s.get('2')).toEqual({ home: 1, away: 0 })
    expect(s.get('3')).toEqual({ home: 1, away: 1 })
    expect(s.get('4')).toEqual({ home: 2, away: 1 })
  })
  it('follows an edit: removing a goal lowers the later scores', () => {
    const s = runningScores([a('1', 'H', 'goal', 100), a('2', 'H', 'goal', 200)].slice(1), 'H', 'A')
    expect(s.get('2')).toEqual({ home: 1, away: 0 })
  })
})

describe('missingFields', () => {
  it('lists only skipped fields that are still empty', () => {
    expect(missingFields({ todo: ['speler', 'keeper'], playerId: '', goalkeeperId: undefined })).toEqual(['speler', 'keeper'])
    expect(missingFields({ todo: ['speler', 'keeper'], playerId: 'p1', goalkeeperId: undefined })).toEqual(['keeper'])
    expect(missingFields({ todo: ['schutter'], playerId: 'p1', shooterId: 'o3' })).toEqual([])
    expect(missingFields({ playerId: '' })).toEqual([])
    expect(missingFields({ todo: ['speler'], playerId: '', staffId: 's1' })).toEqual([])
  })
})

describe('missingFields: assist', () => {
  it('is missing until an assist is filled in', () => {
    expect(missingFields({ todo: ['assist'], playerId: 'p7' })).toEqual(['assist'])
    expect(missingFields({ todo: ['assist'], playerId: 'p7', assistId: 'p9' })).toEqual([])
  })
})
