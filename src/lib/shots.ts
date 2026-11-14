import { KEEPER_FACED_TYPES, SCORING_TYPES } from './actions'
import type { Action, ActionType } from '../types'

/** Actions that can get a ball path and a goal cell in the post-match report. */
export const SHOT_TYPES: ActionType[] = [
  'goal',
  'penalty_goal',
  'penalty_saved',
  'penalty_miss',
  'shot',
  'off_target',
]

export const isShot = (a: Pick<Action, 'type'>) => SHOT_TYPES.includes(a.type)

/** Goal mouth in the normalized frame: 3 m of the 20 m width, centred. */
const GOAL_Y0 = 0.425
const GOAL_W = 0.15

/** Cell 0..8 (row by row from top-left, seen from the shooter) -> row and column. */
export const cellRowCol = (cell: number) => ({ row: Math.floor(cell / 3), col: cell % 3 })

/**
 * Where the ball ends on the goal line (x = 1) for a cell. The shooter looks at
 * the goal: his left is the small-y side of the court, so column 0 = small y.
 */
export function cellGoalPoint(cell: number): { x: number; y: number } {
  const { col } = cellRowCol(cell)
  return { x: 1, y: GOAL_Y0 + ((col + 0.5) / 3) * GOAL_W }
}

export const CELL_NAMES = [
  'links boven', 'midden boven', 'rechts boven',
  'links midden', 'midden', 'rechts midden',
  'links onder', 'midden onder', 'rechts onder',
]

export const hasShotDetail = (a: Action) =>
  a.goalCell !== undefined || a.bounce !== undefined || (a.path?.length ?? 0) > 1 || Boolean(a.note?.trim())

export interface KeeperGrid {
  keeperId: string
  /** Per cell: shots that ended there, and how many of those were goals. */
  cells: { shots: number; goals: number }[]
  bounces: { x: number; y: number }[]
  /** Shots faced without a cell filled in. */
  noCell: number
}

/** Per keeper: where the shots that reached the goal ended up (3x3), plus the bounce points. */
export function keeperGrids(actions: Action[]): KeeperGrid[] {
  const map = new Map<string, KeeperGrid>()
  for (const a of actions) {
    if (!a.goalkeeperId || !KEEPER_FACED_TYPES.includes(a.type)) continue
    const g =
      map.get(a.goalkeeperId) ??
      {
        keeperId: a.goalkeeperId,
        cells: Array.from({ length: 9 }, () => ({ shots: 0, goals: 0 })),
        bounces: [],
        noCell: 0,
      }
    if (a.goalCell !== undefined && a.goalCell >= 0 && a.goalCell <= 8) {
      g.cells[a.goalCell].shots++
      if (SCORING_TYPES.includes(a.type)) g.cells[a.goalCell].goals++
    } else g.noCell++
    if (a.bounce) g.bounces.push(a.bounce)
    map.set(a.goalkeeperId, g)
  }
  return [...map.values()]
}
