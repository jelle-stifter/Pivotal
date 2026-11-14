import { describe, expect, it } from 'vitest'
import { topScorerRows } from './live'
import { POSITION_POINT, POSITIONS, bestPosition, goalsPerPosition, positionLabel } from './positions'
import { opponentColors, ownSide, ownTeamId, opponentTeamId, shortName } from './ownTeam'
import { emptyTotals, playerTotals, shotPercentage, teamTotals } from './stats'
import type { Action, ActionType, PositionCode } from '../types'

let n = 0
function act(
  teamId: string,
  playerId: string,
  type: ActionType,
  extra: Partial<Action> = {},
): Action {
  n++
  return {
    id: `a${n}`,
    matchId: 'm',
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

describe('positions', () => {
  it('has the ten codes of the spec', () => {
    expect(POSITIONS.map((p) => p.code)).toEqual(['LH', 'RH', 'LO', 'RO', 'M', 'C', 'K', 'CC', 'Br', 'P'])
    expect(positionLabel('RH')).toBe('Rechts Hoek')
    expect(positionLabel(undefined)).toBe('')
  })
  it('every code has a spot on the court', () => {
    for (const p of POSITIONS) {
      const s = POSITION_POINT[p.code]
      expect(s.x).toBeGreaterThanOrEqual(0)
      expect(s.x).toBeLessThanOrEqual(1)
      expect(s.y).toBeGreaterThanOrEqual(0)
      expect(s.y).toBeLessThanOrEqual(1)
    }
  })
  it('best position = where most goals came from, not the playing position', () => {
    const goals = [
      act('t', 'p', 'goal', { position: 'RH' }),
      act('t', 'p', 'goal', { position: 'RH' }),
      act('t', 'p', 'goal', { position: 'LH' }),
      act('t', 'p', 'shot', { position: 'M' }),
    ]
    expect(bestPosition(goals)).toBe('RH')
    expect(goalsPerPosition(goals)).toEqual([
      { code: 'RH', goals: 2 },
      { code: 'LH', goals: 1 },
    ])
    expect(bestPosition([])).toBeUndefined()
  })
})

describe('top scorers panel', () => {
  const actions = [
    act('HVM', 'p7', 'goal', { position: 'RH' }),
    act('HVM', 'p7', 'goal', { position: 'RH' }),
    act('HVM', 'p7', 'penalty_goal', { position: 'P' }),
    act('HVM', 'p7', 'shot'),
    act('HVM', 'p7', 'off_target'), // not on target: not in the denominator
    act('HVM', 'p9', 'goal', { position: 'M' }),
    act('HVM', 'p5', 'shot'), // no goal: not listed
    act('EHV', 'o4', 'goal', { position: 'C' }),
  ]
  it('shows goals / shots on target, percentage and best goal position', () => {
    const rows = topScorerRows(actions, 'HVM')
    expect(rows.map((r) => r.playerId)).toEqual(['p7', 'p9'])
    expect(rows[0]).toMatchObject({ goals: 3, onTarget: 4, topPosition: 'RH' })
    expect(rows[0].pct).toBeCloseTo(0.75)
    expect(rows[1]).toMatchObject({ goals: 1, onTarget: 1, pct: 1, topPosition: 'M' })
  })
  it('keeps the teams apart', () => {
    expect(topScorerRows(actions, 'EHV').map((r) => r.playerId)).toEqual(['o4'])
    expect(topScorerRows(actions, 'nobody')).toEqual([])
  })
  it('ignores staff actions (no player)', () => {
    expect(topScorerRows([act('HVM', '', 'suspension', { staffId: 's1' })], 'HVM')).toEqual([])
  })
})

describe('statistics with the new fields', () => {
  it('an assist on a goal counts as an assist for that player and team', () => {
    const actions = [
      act('HVM', 'p7', 'goal', { assistId: 'p9' }),
      act('HVM', 'p7', 'goal', { assistId: 'p9' }),
      act('HVM', 'p7', 'goal'),
      act('HVM', 'p9', 'assist'), // an old-style assist action still counts
    ]
    const players = playerTotals(actions)
    expect(players.get('p9')!.assist).toBe(3)
    expect(players.get('p7')!.goal).toBe(3)
    expect(players.get('p7')!.assist).toBe(0)
    expect(teamTotals(actions).get('HVM')!.assist).toBe(3)
  })
  it('staff cards count for the team but make no player row', () => {
    const actions = [act('HVM', '', 'yellow_card', { staffId: 's1' }), act('HVM', 'p5', 'suspension')]
    expect(playerTotals(actions).has('')).toBe(false)
    expect(teamTotals(actions).get('HVM')!.yellow_card).toBe(1)
  })
  it('blocks count, shots off target stay out of the shot percentage', () => {
    const t = emptyTotals()
    t.goal = 3
    t.shot = 1
    t.off_target = 6
    t.block = 2
    expect(shotPercentage(t)).toBeCloseTo(0.75)
  })
})

describe('own team helpers', () => {
  const m = { homeTeamId: 'A', awayTeamId: 'B' }
  it('defaults to home for older matches', () => {
    expect(ownSide({ ownSide: undefined })).toBe('home')
    expect(ownTeamId(m)).toBe('A')
    expect(opponentTeamId(m)).toBe('B')
  })
  it('own away flips the sides', () => {
    expect(ownTeamId({ ...m, ownSide: 'away' })).toBe('B')
    expect(opponentTeamId({ ...m, ownSide: 'away' })).toBe('A')
  })
  it('short name: given, or the first letters', () => {
    expect(shortName({ name: 'Eindhoven 1', shortName: 'EHV' })).toBe('EHV')
    expect(shortName({ name: 'Eindhoven 1' })).toBe('EIN')
    expect(shortName(undefined)).toBe('?')
  })
  it('opponent colour: grey by default, own choice with a lighter accent', () => {
    expect(opponentColors(undefined).main).toBe('#4b5563')
    expect(opponentColors('nonsense').accent).toBe('#9ca3af')
    const c = opponentColors('#2563eb')
    expect(c.main).toBe('#2563eb')
    expect(c.accent).toMatch(/^#[0-9a-f]{6}$/)
    expect(c.accent).not.toBe(c.main)
  })
  it('type check: codes are PositionCode', () => {
    const p: PositionCode = 'Br'
    expect(positionLabel(p)).toBe('Break')
  })
})
