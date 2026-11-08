import { describe, expect, it } from 'vitest'
import {
  emptyTotals,
  filterActions,
  formatSavePercentage,
  goalkeeperStats,
  goalsWithoutKeeper,
  playerTotals,
  score,
  scoreByPeriod,
  shotPercentage,
  sumTotals,
  teamTotals,
  totalGoals,
  visibleTypes,
} from './stats'
import { periodLabels } from './periods'
import type { Action, ActionType } from '../types'

let n = 0
function act(
  teamId: string,
  playerId: string,
  type: ActionType,
  period = 1,
  goalkeeperId?: string,
): Action {
  n++
  return {
    id: `a${n}`,
    matchId: 'm1',
    teamId,
    playerId,
    type,
    period,
    matchClockMs: n * 1000,
    createdAt: n,
    videoTimeMs: null,
    goalkeeperId,
    schemaVersion: 1,
  }
}

const actions: Action[] = [
  act('H', 'h7', 'goal', 1, 'agk'),
  act('H', 'h7', 'shot', 1),
  act('H', 'h9', 'goal', 2, 'agk'),
  act('A', 'a5', 'goal', 2, 'hgk'),
  act('A', 'a5', 'turnover', 2),
  act('H', 'hgk', 'save', 2),
  act('H', 'hgk', 'save', 3),
  act('A', 'agk', 'save', 3),
  act('A', 'a6', 'foul', 3),
]

describe('playerTotals / teamTotals', () => {
  it('counts per player', () => {
    const t = playerTotals(actions)
    expect(t.get('h7')?.goal).toBe(1)
    expect(t.get('h7')?.shot).toBe(1)
    expect(t.get('a5')?.turnover).toBe(1)
    expect(t.get('hgk')?.save).toBe(2)
  })
  it('counts per team', () => {
    const t = teamTotals(actions)
    expect(t.get('H')?.goal).toBe(2)
    expect(t.get('A')?.goal).toBe(1)
    expect(t.get('H')?.save).toBe(2)
    expect(t.get('A')?.foul).toBe(1)
  })
})

describe('score', () => {
  it('derives the score from goals only', () => {
    expect(score(actions, 'H', 'A')).toEqual({ home: 2, away: 1 })
  })
})

describe('goalkeeperStats', () => {
  it('attributes goals conceded to the stored goalkeeper', () => {
    const [home, away] = goalkeeperStats(actions, ['hgk', 'agk'])
    expect(home).toMatchObject({ saves: 2, goalsConceded: 1 })
    expect(home.savePercentage).toBeCloseTo(2 / 3)
    expect(away).toMatchObject({ saves: 1, goalsConceded: 2 })
    expect(away.savePercentage).toBeCloseTo(1 / 3)
  })
  it('keeps attribution stable when the active keeper changes', () => {
    const a = [
      act('H', 'x', 'goal', 1, 'gk1'),
      act('H', 'x', 'goal', 1, 'gk2'),
    ]
    const [g1, g2] = goalkeeperStats(a, ['gk1', 'gk2'])
    expect(g1.goalsConceded).toBe(1)
    expect(g2.goalsConceded).toBe(1)
  })
  it('returns null percentage when no shots faced', () => {
    const [g] = goalkeeperStats([], ['gk'])
    expect(g.savePercentage).toBeNull()
    expect(formatSavePercentage(g.savePercentage)).toBe('-')
  })
  it('formats percentages', () => {
    expect(formatSavePercentage(2 / 3)).toBe('67%')
    expect(formatSavePercentage(0)).toBe('0%')
  })
})

describe('Lions 2 sheet statistics', () => {
  const mk = (over: Partial<Record<string, number>>) =>
    ({ ...emptyTotals(), ...over }) as ReturnType<typeof emptyTotals>

  it('counts 7-meter goals on the scoreboard and in total goals', () => {
    const a = [
      act('H', 'x', 'goal', 1, 'gk'),
      act('H', 'x', 'penalty_goal', 1, 'gk'),
      act('A', 'y', 'penalty_goal', 2, 'gk'),
      act('A', 'y', 'penalty_miss', 2, 'gk'),
      act('A', 'y', 'penalty_saved', 2, 'gk'),
    ]
    expect(score(a, 'H', 'A')).toEqual({ home: 2, away: 1 })
    expect(totalGoals(mk({ goal: 3, penalty_goal: 2 }))).toBe(5)
  })

  it('has the half-time score per period', () => {
    const a = [
      act('H', 'x', 'goal', 1),
      act('H', 'x', 'penalty_goal', 1),
      act('A', 'y', 'goal', 2),
      act('H', 'x', 'goal', 2),
    ]
    expect(scoreByPeriod(a, 'H', 'A', 2)).toEqual([
      { home: 2, away: 0 },
      { home: 1, away: 1 },
    ])
  })

  it('computes the shot percentage with the Excel formula', () => {
    // (goal + 7m goal) / (goal + miss + 7m goal + 7m stopped + 7m off target)
    const t = mk({ goal: 3, shot: 2, penalty_goal: 1, penalty_saved: 1, penalty_miss: 1 })
    expect(shotPercentage(t)).toBeCloseTo(4 / 8)
    expect(shotPercentage(mk({ goal: 1 }))).toBe(1)
    expect(shotPercentage(mk({ shot: 2 }))).toBe(0)
  })

  it('returns null (GEEN %) when there were no attempts', () => {
    expect(shotPercentage(emptyTotals())).toBeNull()
    expect(shotPercentage(mk({ assist: 4, yellow_card: 1 }))).toBeNull()
  })

  it('does not count assists, cards or won penalties as attempts', () => {
    expect(shotPercentage(mk({ goal: 1, shot: 1, assist: 5, penalty_won: 2 }))).toBe(0.5)
  })

  it('credits 7-meter outcomes to the keeper and computes the percentages', () => {
    const a = [
      act('A', 'p1', 'penalty_saved', 1, 'gk'),
      act('A', 'p1', 'penalty_saved', 1, 'gk'),
      act('A', 'p2', 'penalty_goal', 1, 'gk'),
      act('A', 'p3', 'penalty_miss', 1, 'gk'),
      act('A', 'p4', 'goal', 1, 'gk'),
      act('H', 'gk', 'save', 1),
      act('H', 'gk', 'save', 2),
      act('A', 'p5', 'penalty_goal', 2, 'other'),
    ]
    const [g] = goalkeeperStats(a, ['gk'])
    expect(g).toMatchObject({
      saves: 2,
      goalsConceded: 1,
      penaltySaves: 2,
      penaltyGoalsConceded: 1,
      penaltyMisses: 1,
    })
    expect(g.savePercentage).toBeCloseTo(2 / 3)
    expect(g.penaltySavePercentage).toBeCloseTo(2 / 3)
    // (2 saves + 2 7m saves) / (4 + 1 goal + 1 7m goal)
    expect(g.totalSavePercentage).toBeCloseTo(4 / 6)
  })

  it('leaves the keeper percentages null when nothing was faced', () => {
    const [g] = goalkeeperStats([act('A', 'p', 'penalty_miss', 1, 'gk')], ['gk'])
    expect(g.penaltySavePercentage).toBeNull()
    expect(g.totalSavePercentage).toBeNull()
    expect(g.penaltyMisses).toBe(1)
  })
})

describe('visibleTypes / sumTotals', () => {
  it('always shows the core six, and other types only when they occur', () => {
    expect(visibleTypes([emptyTotals()])).toEqual([
      'goal', 'shot', 'turnover', 'save', 'interception', 'foul',
    ])
    const t = emptyTotals()
    t.assist = 2
    t.red_card = 1
    expect(visibleTypes([emptyTotals(), t])).toEqual([
      'goal', 'shot', 'turnover', 'save', 'interception', 'foul',
      'assist', 'red_card',
    ])
  })
  it('sums totals over several rows', () => {
    const a = emptyTotals(); a.goal = 2; a.assist = 1
    const b = emptyTotals(); b.goal = 3; b.penalty_goal = 1
    const sum = sumTotals([a, b])
    expect(sum).toMatchObject({ goal: 5, assist: 1, penalty_goal: 1, shot: 0 })
    expect(totalGoals(sum)).toBe(6)
  })
})

describe('goalsWithoutKeeper', () => {
  it('counts goals that have no credited keeper', () => {
    const a = [
      act('H', 'x', 'goal', 1, 'gk'),
      act('H', 'x', 'goal', 1),
      act('H', 'x', 'shot', 1),
    ]
    expect(goalsWithoutKeeper(a)).toBe(1)
    expect(goalsWithoutKeeper([])).toBe(0)
  })
})

describe('filterActions', () => {
  it('filters by team, player, type and combined', () => {
    expect(filterActions(actions, { teamId: 'A' })).toHaveLength(4)
    expect(filterActions(actions, { playerId: 'h7' })).toHaveLength(2)
    expect(filterActions(actions, { type: 'goal' })).toHaveLength(3)
    expect(filterActions(actions, { teamId: 'H', type: 'save' })).toHaveLength(2)
  })
  it('returns everything for an empty filter', () => {
    expect(filterActions(actions, {})).toHaveLength(actions.length)
  })
  it('filters by period in a 3-third match', () => {
    expect(filterActions(actions, { period: 1 })).toHaveLength(2)
    expect(filterActions(actions, { period: 2 })).toHaveLength(4)
    expect(filterActions(actions, { period: 3 })).toHaveLength(3)
  })
  it('filters by period in a 2-half match', () => {
    const two = [
      act('H', 'p', 'goal', 1),
      act('H', 'p', 'goal', 2),
      act('H', 'p', 'shot', 2),
    ]
    expect(filterActions(two, { period: 1 })).toHaveLength(1)
    expect(filterActions(two, { period: 2 })).toHaveLength(2)
    expect(filterActions(two, { period: 3 })).toHaveLength(0)
  })
})

describe('periodLabels', () => {
  it('labels halves and thirds', () => {
    expect(periodLabels(2)).toEqual(['1e helft', '2e helft'])
    expect(periodLabels(3)).toEqual(['1e derde', '2e derde', '3e derde'])
  })
})
