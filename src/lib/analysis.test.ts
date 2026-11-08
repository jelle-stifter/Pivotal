import { describe, expect, it } from 'vitest'
import {
  biggestLead,
  compareRows,
  scoreTimeline,
  topScorers,
} from './analysis'
import type { Action, ActionType } from '../types'

let n = 0
function act(
  teamId: string,
  playerId: string,
  type: ActionType,
  matchClockMs: number,
): Action {
  n++
  return {
    id: `a${n}`,
    matchId: 'm',
    teamId,
    playerId,
    type,
    period: 1,
    matchClockMs,
    createdAt: n,
    videoTimeMs: null,
    schemaVersion: 1,
  }
}

describe('scoreTimeline', () => {
  it('starts 0-0 and follows scoring actions in clock order', () => {
    const actions = [
      act('B', 'b1', 'goal', 20000),
      act('A', 'a1', 'goal', 10000),
      act('A', 'a1', 'penalty_goal', 30000),
      act('A', 'a1', 'shot', 35000), // not scoring
    ]
    const tl = scoreTimeline(actions, 'A', 'B')
    expect(tl.map((p) => [p.home, p.away])).toEqual([
      [0, 0],
      [1, 0],
      [1, 1],
      [2, 1],
    ])
  })

  it('biggestLead reports the largest lead per side', () => {
    const actions = [
      act('A', 'a1', 'goal', 1),
      act('A', 'a1', 'goal', 2),
      act('A', 'a1', 'goal', 3),
      act('B', 'b1', 'goal', 4),
      act('B', 'b1', 'goal', 5),
      act('B', 'b1', 'goal', 6),
      act('B', 'b1', 'goal', 7),
      act('B', 'b1', 'goal', 8),
    ]
    expect(biggestLead(scoreTimeline(actions, 'A', 'B'))).toEqual({
      home: 3,
      away: 2,
    })
  })
})

describe('topScorers', () => {
  it('counts goals plus 7m goals and sorts descending', () => {
    const actions = [
      act('A', 'x', 'goal', 1),
      act('A', 'y', 'goal', 2),
      act('A', 'y', 'penalty_goal', 3),
      act('A', 'z', 'shot', 4),
    ]
    const top = topScorers(actions)
    expect(top.map((s) => s.playerId)).toEqual(['y', 'x'])
    expect(top[0]).toMatchObject({ goals: 1, penaltyGoals: 1, total: 2 })
  })
})

describe('compareRows', () => {
  it('drops rows where both teams have zero and formats shot%', () => {
    const actions = [
      act('A', 'a1', 'goal', 1),
      act('A', 'a1', 'shot', 2),
      act('B', 'b1', 'goal', 3),
      act('B', 'b1', 'foul', 4),
    ]
    const rows = compareRows(actions, 'A', 'B')
    const keys = rows.map((r) => r.key)
    expect(keys).toContain('goals')
    expect(keys).toContain('foul')
    expect(keys).not.toContain('cards')
    const pct = rows.find((r) => r.key === 'shotpct')!
    expect(pct.homeText).toBe('50%')
    expect(pct.awayText).toBe('100%')
  })
})

import { liveMatchIds } from './analysis'

describe('liveMatchIds', () => {
  it('flags matches with an action in the last 3 hours only', () => {
    const now = 10_000_000_000
    const h = 60 * 60 * 1000
    const live = liveMatchIds(
      [
        { matchId: 'new', createdAt: now - 10 * 60 * 1000 },
        { matchId: 'old', createdAt: now - 4 * h },
        { matchId: 'mixed', createdAt: now - 5 * h },
        { matchId: 'mixed', createdAt: now - h },
      ],
      now,
    )
    expect([...live].sort()).toEqual(['mixed', 'new'])
  })
})
