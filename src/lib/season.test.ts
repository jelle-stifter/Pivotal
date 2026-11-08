import { describe, expect, it } from 'vitest'
import {
  filterSeasonMatches,
  matchResults,
  recordOf,
  seasonOf,
  seasonPlayerRows,
  seasonsOf,
} from './season'
import { goalkeeperStats } from './stats'
import type { Action, ActionType, Match } from '../types'

const match = (id: string, date: string, home: string, away: string, format: 2 | 3 = 2): Match => ({
  id, homeTeamId: home, awayTeamId: away, date, format,
  currentPeriod: 2, clockMs: 0, activeGoalkeeper: {}, schemaVersion: 1,
})

let n = 0
const act = (
  matchId: string, teamId: string, playerId: string, type: ActionType,
  period = 1, goalkeeperId?: string,
): Action => ({
  id: `a${++n}`, matchId, teamId, playerId, type, period,
  matchClockMs: n * 1000, createdAt: n, videoTimeMs: null, goalkeeperId, schemaVersion: 1,
})

describe('seasonOf', () => {
  it('runs from August to July', () => {
    expect(seasonOf('2020-08-01')).toBe('2020-2021')
    expect(seasonOf('2020-09-12')).toBe('2020-2021')
    expect(seasonOf('2020-12-31')).toBe('2020-2021')
    expect(seasonOf('2021-01-01')).toBe('2020-2021')
    expect(seasonOf('2021-07-31')).toBe('2020-2021')
    expect(seasonOf('2021-08-01')).toBe('2021-2022')
  })
  it('lists distinct seasons newest first', () => {
    const ms = [{ date: '2020-10-01' }, { date: '2021-09-01' }, { date: '2021-02-01' }]
    expect(seasonsOf(ms)).toEqual(['2021-2022', '2020-2021'])
  })
})

describe('filterSeasonMatches', () => {
  const ms = [
    match('m3', '2021-02-01', 'L', 'B'),
    match('m1', '2020-10-01', 'L', 'A'),
    match('m2', '2020-11-01', 'C', 'L'),
    match('m4', '2021-10-01', 'L', 'A'),
    match('m5', '2020-12-01', 'X', 'Y'),
  ]
  it('filters by season and team, sorted by date', () => {
    expect(filterSeasonMatches(ms, { season: '2020-2021', teamId: 'L' }).map((m) => m.id))
      .toEqual(['m1', 'm2', 'm3'])
  })
  it('returns everything for an empty filter, still sorted', () => {
    expect(filterSeasonMatches(ms, {}).map((m) => m.id)).toEqual(['m1', 'm2', 'm5', 'm3', 'm4'])
  })
  it('keeps matches where the team played home or away only', () => {
    expect(filterSeasonMatches(ms, { teamId: 'C' }).map((m) => m.id)).toEqual(['m2'])
  })
})

describe('seasonPlayerRows', () => {
  const actions = [
    act('m1', 'L', 'p1', 'goal'),
    act('m1', 'L', 'p1', 'assist'),
    act('m2', 'L', 'p1', 'penalty_goal'),
    act('m2', 'L', 'p2', 'shot'),
    act('m3', 'L', 'p1', 'goal'), // match m3 is outside the selection
  ]
  const rows = seasonPlayerRows(new Set(['m1', 'm2']), actions)
  const byId = Object.fromEntries(rows.map((r) => [r.playerId, r]))

  it('sums actions over the selected matches only', () => {
    expect(byId.p1.totals).toMatchObject({ goal: 1, assist: 1, penalty_goal: 1 })
    expect(byId.p2.totals).toMatchObject({ shot: 1, goal: 0 })
  })
  it('counts the matches in which a player has actions', () => {
    expect(byId.p1.matches).toBe(2)
    expect(byId.p2.matches).toBe(1)
  })
  it('gives nothing for no matches', () => {
    expect(seasonPlayerRows(new Set(), actions)).toEqual([])
  })
})

describe('matchResults / recordOf', () => {
  const ms = [
    match('m1', '2020-10-01', 'L', 'A'), // L wins 3-2, 2-1 at half
    match('m2', '2020-11-01', 'C', 'L'), // 1-1, draw
    match('m3', '2021-02-01', 'L', 'B', 3), // L loses 0-1, 3 thirds -> no half time
  ]
  const actions = [
    act('m1', 'L', 'p', 'goal', 1), act('m1', 'L', 'p', 'penalty_goal', 1),
    act('m1', 'A', 'q', 'goal', 1), act('m1', 'L', 'p', 'goal', 2), act('m1', 'A', 'q', 'goal', 2),
    act('m2', 'C', 'r', 'goal', 1), act('m2', 'L', 'p', 'goal', 2),
    act('m3', 'B', 's', 'goal', 1),
    act('m1', 'L', 'p', 'shot', 1), // not a goal
  ]

  it('computes score, half-time score and the result from the team view', () => {
    const r = matchResults(ms, actions, 'L')
    expect(r[0]).toMatchObject({
      homeGoals: 3, awayGoals: 2, half: { home: 2, away: 1 },
      goalsFor: 3, goalsAgainst: 2, result: 'W',
    })
    expect(r[1]).toMatchObject({ homeGoals: 1, awayGoals: 1, goalsFor: 1, goalsAgainst: 1, result: 'G' })
    expect(r[2]).toMatchObject({ goalsFor: 0, goalsAgainst: 1, result: 'V', half: null })
  })
  it('reads home/away correctly when the team plays away', () => {
    const r = matchResults([ms[1]], actions, 'L')
    expect(r[0].goalsFor).toBe(1) // L is the away team in m2
  })
  it('has no team result without a team', () => {
    const r = matchResults(ms, actions)
    expect(r[0].result).toBeUndefined()
    expect(recordOf(r).played).toBe(0)
  })
  it('summarises the record', () => {
    expect(recordOf(matchResults(ms, actions, 'L'))).toEqual({
      played: 3, won: 1, drawn: 1, lost: 1, goalsFor: 4, goalsAgainst: 4,
    })
  })
})

describe('keeper stats over a season', () => {
  it('adds up goals conceded and saves over several matches', () => {
    const actions = [
      act('m1', 'A', 'x', 'goal', 1, 'gk'), act('m1', 'L', 'gk', 'save'),
      act('m2', 'A', 'x', 'goal', 1, 'gk'), act('m2', 'L', 'gk', 'save'), act('m2', 'L', 'gk', 'save'),
      act('m2', 'A', 'x', 'penalty_saved', 1, 'gk'),
    ]
    const [g] = goalkeeperStats(actions, ['gk'])
    expect(g).toMatchObject({ saves: 3, goalsConceded: 2, penaltySaves: 1 })
    expect(g.savePercentage).toBeCloseTo(3 / 5)
  })
})
