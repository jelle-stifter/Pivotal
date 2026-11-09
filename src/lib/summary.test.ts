import { describe, expect, it } from 'vitest'
import { matchSummary } from './summary'
import type { Action, Match, Player } from '../types'

const match: Match = {
  id: 'm',
  homeTeamId: 'H',
  awayTeamId: 'A',
  date: '2026-11-09',
  location: 'Sporthal Test',
  format: 2,
  currentPeriod: 2,
  clockMs: 0,
  activeGoalkeeper: {},
  schemaVersion: 1,
}
const player = (id: string, teamId: string, name: string): Player => ({
  id,
  teamId,
  name,
  number: 1,
  position: '',
  isGoalkeeper: false,
  schemaVersion: 1,
})
const goal = (id: string, teamId: string, playerId: string, period: number): Action => ({
  id,
  matchId: 'm',
  teamId,
  playerId,
  type: 'goal',
  period,
  matchClockMs: 0,
  createdAt: 1,
  videoTimeMs: null,
  schemaVersion: 1,
})
const teamName = (id: string) => (id === 'H' ? 'Backhand' : 'Tegenstander')

describe('matchSummary', () => {
  const players = [player('p1', 'H', 'Daan'), player('p2', 'A', 'Jan')]
  const actions = [goal('1', 'H', 'p1', 1), goal('2', 'H', 'p1', 2), goal('3', 'A', 'p2', 1)]

  it('shows result, half-time score and top scorers', () => {
    const text = matchSummary({ match, teamName, players, actions })
    expect(text).toContain('Backhand 2 – 1 Tegenstander')
    expect(text).toContain('Tussenstand · 09-11-2026 · Sporthal Test')
    expect(text).toContain('Rust: 1 – 1')
    expect(text).toContain('Topscorers: Daan (2), Jan (1)')
  })

  it('says Eindstand for a finished match and skips empty parts', () => {
    const text = matchSummary({
      match: { ...match, finishedAt: 5, currentPeriod: 1, location: undefined },
      teamName,
      players,
      actions: [],
    })
    expect(text).toContain('Backhand 0 – 0 Tegenstander')
    expect(text).toContain('Eindstand · 09-11-2026')
    expect(text).not.toContain('Topscorers')
  })
})
