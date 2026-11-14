export const SCHEMA_VERSION = 2

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
  // Added for the tablet live screen:
  | 'block' // save door een veldspeler (blokkeert het schot op doel)
  | 'off_target' // schot niet op doel

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
  'block',
  'off_target',
]

export type MatchFormat = 2 | 3
export type Side = 'home' | 'away'

/** Court position of a goal (dropdown on the live screen). */
export type PositionCode = 'LH' | 'RH' | 'LO' | 'RO' | 'M' | 'C' | 'K' | 'CC' | 'Br' | 'P'

/** Fields that can be skipped during the match and filled in afterwards. */
export type TodoField = 'speler' | 'keeper' | 'schutter'

export interface Timeout {
  teamId: string
  /** Game clock (ms) when the timeout was taken. */
  clockMs: number
  period: number
}

export type AbsenceReason = 'afwezig' | 'blessure' | 'niet_in_selectie'

export interface StaffMember {
  id: string
  name: string
  /** Free text; the Teams page offers presets (eerste trainer, assistent, ...). */
  role: string
}

export interface Team {
  id: string
  name: string
  /** Short name on the scoreboard (e.g. EHV); falls back to the first letters. */
  shortName?: string
  /** Coaches and other staff; they can get a card or a 2-minute suspension. */
  staff?: StaffMember[]
  schemaVersion: number
}

export interface Player {
  id: string
  teamId: string
  name: string
  number: number
  /** Full position name (e.g. "Rechts Hoek"); empty = none. */
  position: string
  /** Abbreviation that belongs to `position` (e.g. "RH"). */
  positionCode?: PositionCode
  isGoalkeeper: boolean
  schemaVersion: number
}

export interface Match {
  id: string
  homeTeamId: string
  awayTeamId: string
  date: string // ISO date (yyyy-mm-dd)
  location?: string
  /** Kick-off time (hh:mm). */
  time?: string
  /** New matches are always 2 halves; 3 only occurs in older data. */
  format: MatchFormat
  /** Which side our own team (HVM) plays on; absent means home. */
  ownSide?: Side
  /** Colour of the opponent on the live screen (hex). */
  opponentColor?: string
  /** Post-match report: free notes about the match. */
  reportNote?: string
  /** Own players that do not play, with the reason. Others are playing. */
  absent?: Record<string, AbsenceReason>
  /** The coach's own top 3 penalty takers (player ids, best first). */
  penaltyTakers?: string[]
  currentPeriod: number // 1-based
  /** Time played in the current period (ms); the live screen counts down from the half length. */
  clockMs: number
  activeGoalkeeper: { home?: string; away?: string } // player ids
  /** Which way the home team attacks on screen; absent means true. */
  homeAttacksRight?: boolean
  /** Epoch ms when the match was ended by hand; absent = not ended. */
  finishedAt?: number
  /**
   * Epoch ms when the clock was last started; absent = clock paused.
   * Wall-clock based, so the timer keeps running while the coach looks at
   * other screens (or reloads the app).
   */
  clockStartedAt?: number
  /** Timeouts per team with the clock moment (for the report only). */
  timeouts?: Timeout[]
  /** Online account (user id) that may score this match; set by a coach. */
  scorerId?: string
  /** Who is scoring right now (advisory lock, so two people do not clash). */
  liveBy?: string
  liveByName?: string
  liveAt?: number
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
  /** Position code of a goal (LH, RH, ...). */
  position?: PositionCode
  /** Set on goals: the player who gave the assist (empty = no assist). */
  assistId?: string
  /** Penalties: the player who was fouled and the player who fouled. */
  fouledId?: string
  foulerId?: string
  /** Set for staff members (cards / suspensions); playerId is then ''. */
  staffId?: string
  /** Post-match report: where the ball first touched the floor (same frame as x, y). */
  bounce?: { x: number; y: number }
  /** Post-match report: goal cell 0..8, row by row from the top-left, seen from the shooter. */
  goalCell?: number
  /** Post-match report: a hand-drawn line of the ball (same frame as x, y). */
  path?: { x: number; y: number }[]
  /** Post-match report: free note on this action. */
  note?: string
  /** Opponent who took the shot that our keeper stopped. */
  shooterId?: string
  /** Skipped during the match ("Nog invullen"); see missingFields(). */
  todo?: TodoField[]
  /** True for the shot after a stopped penalty (rebound). */
  rebound?: boolean
  /** Actions that were logged in one flow share this id (undo removes all). */
  groupId?: string
  schemaVersion: number
}

export interface ActionFilter {
  teamId?: string
  playerId?: string
  type?: ActionType
  period?: number
}
