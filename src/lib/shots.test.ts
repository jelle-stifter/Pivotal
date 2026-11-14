import { describe, expect, it } from 'vitest'
import { cellGoalPoint, hasShotDetail, keeperGrids, isShot } from './shots'
import type { Action } from '../types'

const act = (o: Partial<Action>): Action => ({
  id: 'a', matchId: 'm', teamId: 't', playerId: 'p', type: 'goal', period: 1,
  matchClockMs: 0, createdAt: 0, videoTimeMs: null, schemaVersion: 2, ...o,
})

describe('shots', () => {
  it('goal point: left column is the small-y side, all inside the goal mouth', () => {
    expect(cellGoalPoint(0).y).toBeLessThan(cellGoalPoint(1).y)
    expect(cellGoalPoint(1).y).toBeCloseTo(0.5)
    expect(cellGoalPoint(8).y).toBeGreaterThan(cellGoalPoint(7).y)
    expect(cellGoalPoint(3).y).toBeCloseTo(cellGoalPoint(0).y)
    expect(cellGoalPoint(4).x).toBe(1)
  })
  it('knows which actions are shots and which have detail', () => {
    expect(isShot(act({ type: 'penalty_saved' }))).toBe(true)
    expect(isShot(act({ type: 'turnover' }))).toBe(false)
    expect(hasShotDetail(act({}))).toBe(false)
    expect(hasShotDetail(act({ goalCell: 0 }))).toBe(true)
    expect(hasShotDetail(act({ note: ' ' }))).toBe(false)
  })
  it('counts cells per keeper, goals separate, and keeps bounce points', () => {
    const grids = keeperGrids([
      act({ goalkeeperId: 'k', goalCell: 4, bounce: { x: 0.9, y: 0.5 } }),
      act({ goalkeeperId: 'k', goalCell: 4, type: 'penalty_saved' }),
      act({ goalkeeperId: 'k' }),
      act({ type: 'shot', goalkeeperId: 'k', goalCell: 1 }),
    ])
    expect(grids).toHaveLength(1)
    expect(grids[0].cells[4]).toEqual({ shots: 2, goals: 1 })
    expect(grids[0].noCell).toBe(1)
    expect(grids[0].bounces).toHaveLength(1)
  })
})
