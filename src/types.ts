export const SCHEMA_VERSION = 1

export type ActionType =
  | 'goal'
  | 'shot'
  | 'turnover'
  | 'save'
  | 'interception'
  | 'foul'
  // Added for the Lions 2 statistics sheet:
  | 'assist'
  | 'penalty_goal' // 7 meter doelpunt
  | 'penalty_miss' // 7 meter niet op doel
  | 'penalty_saved' // 7 meter gestopt door de keeper
  | 'penalty_won' // 7 meter gekregen
  | 'bad_pass' // passfout
  | 'technical_foul' // technische fout
  | 'yellow_card'
  | 'suspension' // 2 minuten
  | 'red_card'
  | 'blue_card'

/**
 * Order matters: the original six stay first so existing exports keep
 * their column order; new types are appended.
 */
export const ACTION_TYPES: ActionType[] = [
  'goal',
  'shot',
  'turnover',
  'save',
  'interception',
  'foul',
  'assist',
  'penalty_goal',
  'penalty_miss',
  'penalty_saved',
  'penalty_won',
  'bad_pass',
  'technical_foul',
  'yellow_card',
  'suspension',
  'red_card',
  'blue_card',
]

export type MatchFormat = 2 | 3
export type Side = 'home' | 'away'

export interface Team {
  id: string
  name: string
  schemaVersion: number
}

export interface Player {
  id: string
  teamId: string
  name: string
  number: number
  position: string
  isGoalkeeper: boolean
  schemaVersion: number
}

export interface Match {
  id: string
  homeTeamId: string
  awayTeamId: string
  date: string // ISO date (yyyy-mm-dd)
  location?: string
  format: MatchFormat
  currentPeriod: number // 1-based
  clockMs: number
  activeGoalkeeper: { home?: string; away?: string } // player ids
  /** Which way the home team attacks on screen; absent means true. */
  homeAttacksRight?: boolean
  schemaVersion: number
}

export interface Action {
  id: string
  matchId: string
  teamId: string
  playerId: string
  type: ActionType
  period: number // 1-based
  matchClockMs: number
  createdAt: number // epoch ms
  /** Future video sync; always null in phase 1. */
  videoTimeMs: number | null
  /**
   * Set on goal actions: the opposing goalkeeper on court when the goal
   * was scored. Keeps "goals conceded" stable when the active keeper changes.
   */
  goalkeeperId?: string
  /**
   * Court position, attack-normalized from the acting team's perspective:
   * x=0 own goal line, x=1 opponent goal line, y=0..1 across the width.
   * Absent for actions logged without a position.
   */
  x?: number
  y?: number
  schemaVersion: number
}

export interface ActionFilter {
  teamId?: string
  playerId?: string
  type?: ActionType
  period?: number
}
