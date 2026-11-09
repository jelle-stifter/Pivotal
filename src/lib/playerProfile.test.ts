import { describe, expect, it } from 'vitest'
import { playerProfile } from './playerProfile'
import { matchResults, ownVersusOpponent } from './season'
import type { Action, ActionType, Match } from '../types'

let n = 0
function act(
  matchId: string,
  teamId: string,
  playerId: string,
  type: ActionType,
  extra: Partial<Action> = {},
): Action {
  n++
  return {
    id: `a${n}`,
    matchId,
    teamId,
    playerId,
    type,
    period: 1,
    matchClockMs: n * 1000,
    createdAt: n,
    videoTimeMs: null,
    schemaVersion: 2,
    ...extra,
  }
}

describe('playerProfile', () => {
  const actions: Action[] = [
    act('m1', 'H', 'p7', 'goal', { position: 'RH' }),
    act('m1', 'H', 'p7', 'goal', { position: 'RH' }),
    act('m1', 'H', 'p7', 'goal', { position: 'LH', assistId: 'p9' }),
    act('m1', 'H', 'p7', 'shot'),
    act('m1', 'H', 'p7', 'off_target'),
    act('m2', 'H', 'p7', 'penalty_goal', { position: 'P', fouledId: 'p9', foulerId: 'o3' }),
    act('m2', 'H', 'p7', 'penalty_saved'),
    act('m2', 'H', 'p7', 'penalty_miss'),
    act('m2', 'H', 'p7', 'block'),
    act('m2', 'H', 'p7', 'interception'),
    act('m2', 'H', 'p7', 'bad_pass'),
    act('m2', 'H', 'p7', 'technical_foul'),
    act('m2', 'H', 'p7', 'turnover'),
    act('m2', 'H', 'p7', 'foul'),
    act('m2', 'H', 'p7', 'yellow_card'),
    act('m2', 'H', 'p7', 'suspension'),
    act('m2', 'H', 'p7', 'suspension'),
    act('m2', 'H', 'p7', 'red_card'),
    act('m2', 'H', 'p7', 'blue_card'),
    // other players
    act('m1', 'H', 'p9', 'goal', { position: 'M' }),
    act('m3', 'H', 'p9', 'penalty_goal', { position: 'P', fouledId: 'p5', foulerId: 'p7' }),
  ]
  const p = playerProfile(actions, 'p7')

  it('counts goals, 7m goals and shots', () => {
    expect(p.goals).toBe(3)
    expect(p.penaltyGoals).toBe(1)
    expect(p.totalGoals).toBe(4)
    // goals 3 + 7m goal 1 + shot 1 + 7m saved 1
    expect(p.shotsOnTarget).toBe(6)
    // off target 1 + 7m off target 1
    expect(p.shotsOffTarget).toBe(2)
    expect(p.shotPct).toBeCloseTo(4 / 6)
  })
  it('has no shot percentage without shots', () => {
    expect(playerProfile(actions, 'nobody').shotPct).toBeNull()
  })
  it('counts defence, errors and fouls (also fouls that caused a penalty)', () => {
    expect(p.blocks).toBe(1)
    expect(p.interceptions).toBe(1)
    expect(p.turnovers).toBe(3) // turnover + bad pass + technical foul
    expect(p.fouls).toBe(2) // 1 logged + 1 that caused the 7m of p9
  })
  it('counts cards and suspensions', () => {
    expect(p.yellow).toBe(1)
    expect(p.suspensions).toBe(2)
    expect(p.red).toBe(1)
    expect(p.blue).toBe(1)
  })
  it('counts penalties taken, scored, saved, off target, won and caused', () => {
    expect(p.penalties).toEqual({ taken: 3, scored: 1, saved: 1, offTarget: 1, won: 0, caused: 1 })
  })
  it('credits the assist giver and the player who won a penalty', () => {
    const q = playerProfile(actions, 'p9')
    expect(q.assists).toBe(1)
    expect(q.penalties.won).toBe(1) // fouled in m2
  })
  it('counts goals per position of the player, best first', () => {
    expect(p.goalsPerPosition).toEqual([
      { code: 'RH', goals: 2 },
      { code: 'LH', goals: 1 },
      { code: 'P', goals: 1 },
    ])
  })
  it('lists the matches where the player shows up in any role', () => {
    expect(p.matchIds.sort()).toEqual(['m1', 'm2', 'm3'])
    expect(playerProfile(actions, 'p9').matchIds.sort()).toEqual(['m1', 'm2', 'm3'])
  })
  it('keeper statistics come along', () => {
    const k = playerProfile(
      [
        act('m1', 'H', 'gk', 'save'),
        act('m1', 'H', 'gk', 'save'),
        act('m1', 'A', 'o1', 'goal', { goalkeeperId: 'gk' }),
      ],
      'gk',
    )
    expect(k.keeper.saves).toBe(2)
    expect(k.keeper.goalsConceded).toBe(1)
    expect(k.keeper.savePercentage).toBeCloseTo(2 / 3)
  })
})

describe('own team against the opponent (overview)', () => {
  const match = (id: string, home: string, away: string, ownSide?: 'home' | 'away'): Match => ({
    id,
    homeTeamId: home,
    awayTeamId: away,
    date: '2026-11-09',
    format: 2,
    currentPeriod: 2,
    clockMs: 0,
    activeGoalkeeper: {},
    ownSide,
    schemaVersion: 2,
  })
  const goals = (matchId: string, teamId: string, k: number) =>
    Array.from({ length: k }, () => act(matchId, teamId, 'x', 'goal'))

  it('per match: what we scored against what the opponent scored', () => {
    const [r] = matchResults(
      [match('m1', 'HVM', 'EHV')],
      [...goals('m1', 'HVM', 5), ...goals('m1', 'EHV', 3)],
    )
    expect(r.ownGoals).toBe(5)
    expect(r.opponentGoals).toBe(3)
  })
  it('when we play away the sides are turned around', () => {
    const [r] = matchResults(
      [match('m1', 'EHV', 'HVM', 'away')],
      [...goals('m1', 'EHV', 3), ...goals('m1', 'HVM', 5)],
    )
    expect(r.homeGoals).toBe(3)
    expect(r.ownGoals).toBe(5)
    expect(r.opponentGoals).toBe(3)
  })
  it('over a season: 5 against 3, not "8 goals"', () => {
    const results = matchResults(
      [match('m1', 'HVM', 'EHV'), match('m2', 'ABC', 'HVM', 'away')],
      [
        ...goals('m1', 'HVM', 5), ...goals('m1', 'EHV', 3),
        ...goals('m2', 'HVM', 2), ...goals('m2', 'ABC', 4),
      ],
    )
    expect(ownVersusOpponent(results)).toEqual({ for: 7, against: 7 })
    expect(ownVersusOpponent([])).toEqual({ for: 0, against: 0 })
  })
  it('older matches without a side count the home team as ours', () => {
    const [r] = matchResults([match('m1', 'HVM', 'EHV')], goals('m1', 'HVM', 1))
    expect(r.ownGoals).toBe(1)
  })
})
