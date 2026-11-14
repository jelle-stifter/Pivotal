import { describe, expect, it } from 'vitest'
import { fieldPlayerCells, hasFieldData, keeperCells, showCell } from './statTables'
import { emptyTotals, goalkeeperStats } from './stats'
import type { Action } from '../types'

const totals = (patch: Partial<ReturnType<typeof emptyTotals>>) => ({ ...emptyTotals(), ...patch })

describe('fieldPlayerCells', () => {
  it('leaves every cell empty (never 0) for a player without data', () => {
    const c = fieldPlayerCells(emptyTotals())
    expect(Object.values(c).every((v) => v === null)).toBe(true)
    expect(hasFieldData(emptyTotals())).toBe(false)
  })

  it('sums goals and shots as specified', () => {
    const c = fieldPlayerCells(
      totals({ goal: 3, shot: 2, penalty_goal: 1, penalty_saved: 1, penalty_miss: 1, off_target: 4 }),
    )
    expect(c.totalGoals).toBe(4) // goals + 7m goals
    expect(c.totalShots).toBe(8) // 3 + 2 + 1 + 1 + 1; "niet op doel" tel je niet mee
    expect(c.shotPct).toBe(50) // 4 / 8
  })

  it('rounds the percentage to whole percents', () => {
    expect(fieldPlayerCells(totals({ goal: 1, shot: 2 })).shotPct).toBe(33)
    expect(fieldPlayerCells(totals({ goal: 2, shot: 1 })).shotPct).toBe(67)
  })

  it('shows 0% when there were shots but no goals, but no percentage without shots', () => {
    expect(fieldPlayerCells(totals({ shot: 2 })).shotPct).toBe(0)
    expect(fieldPlayerCells(totals({ assist: 1 })).shotPct).toBeNull()
  })

  it('adds up the fouls and keeps the other columns apart', () => {
    const c = fieldPlayerCells(
      totals({ interception: 1, bad_pass: 2, technical_foul: 1, foul: 5, assist: 2, penalty_won: 1, yellow_card: 1, suspension: 2, red_card: 1, blue_card: 1 }),
    )
    expect(c.fouls).toBe(4) // the plain "foul" type is not part of this column
    expect(c).toMatchObject({ assists: 2, penaltyWon: 1, yellow: 1, suspension: 2, red: 1, blue: 1 })
    expect(c.totalGoals).toBeNull()
  })
})

describe('keeperCells', () => {
  const act = (type: Action['type'], playerId: string, goalkeeperId?: string) =>
    ({ id: Math.random().toString(), type, playerId, goalkeeperId }) as Action

  it('is empty for a keeper without data', () => {
    const [g] = goalkeeperStats([], ['k1'])
    expect(Object.values(keeperCells(g)).every((v) => v === null)).toBe(true)
  })

  it('adds stops and 7m stops, and divides by all shots on goal', () => {
    const actions = [
      act('save', 'k1'),
      act('save', 'k1'),
      act('penalty_saved', 'o1', 'k1'),
      act('goal', 'o2', 'k1'),
      act('penalty_goal', 'o3', 'k1'),
    ]
    const c = keeperCells(goalkeeperStats(actions, ['k1'])[0])
    expect(c).toMatchObject({ saves: 2, penaltySaved: 1, totalSaves: 3, goalsAgainst: 1, penaltyGoalsAgainst: 1, totalShots: 5 })
    expect(c.savePct).toBe(60)
  })
})

describe('showCell', () => {
  it('shows nothing for an empty cell and the number (with suffix) otherwise', () => {
    expect(showCell(null)).toBe('')
    expect(showCell(0)).toBe('0')
    expect(showCell(50, '%')).toBe('50%')
  })
})
