import { CORE_TYPES, SCORING_TYPES } from './actions'
import {
  ACTION_TYPES,
  type Action,
  type ActionFilter,
  type ActionType,
} from '../types'

export type Totals = Record<ActionType, number>

export function emptyTotals(): Totals {
  return Object.fromEntries(ACTION_TYPES.map((t) => [t, 0])) as Totals
}

export function filterActions(
  actions: Action[],
  filter: ActionFilter,
): Action[] {
  return actions.filter(
    (a) =>
      (filter.teamId === undefined || a.teamId === filter.teamId) &&
      (filter.playerId === undefined || a.playerId === filter.playerId) &&
      (filter.type === undefined || a.type === filter.type) &&
      (filter.period === undefined || a.period === filter.period),
  )
}

function totalsBy(actions: Action[], key: 'playerId' | 'teamId') {
  const map = new Map<string, Totals>()
  for (const a of actions) {
    const t = map.get(a[key]) ?? emptyTotals()
    t[a.type]++
    map.set(a[key], t)
  }
  return map
}

export const playerTotals = (actions: Action[]) => totalsBy(actions, 'playerId')
export const teamTotals = (actions: Action[]) => totalsBy(actions, 'teamId')

/**
 * Columns to show: the core six plus any other action type that occurs,
 * so tables stay readable but nothing recorded is hidden.
 */
export function visibleTypes(totals: Iterable<Totals>): ActionType[] {
  const all = [...totals]
  return ACTION_TYPES.filter(
    (t) => CORE_TYPES.includes(t) || all.some((x) => x[t] > 0),
  )
}

export function sumTotals(list: Totals[]): Totals {
  const out = emptyTotals()
  for (const x of list) for (const t of ACTION_TYPES) out[t] += x[t]
  return out
}

/** Goals including 7-meter goals (both count on the scoreboard). */
export function totalGoals(t: Totals): number {
  return SCORING_TYPES.reduce((s, type) => s + t[type], 0)
}

/**
 * Shot percentage as on the Lions 2 sheet:
 * (goals + 7m goals) / (goals + misses + 7m goals + 7m stopped + 7m off target).
 * null when there were no attempts (the sheet shows "GEEN %").
 */
export function shotPercentage(t: Totals): number | null {
  const attempts =
    t.goal + t.shot + t.penalty_goal + t.penalty_saved + t.penalty_miss
  return attempts === 0 ? null : (t.goal + t.penalty_goal) / attempts
}

export function score(
  actions: Action[],
  homeTeamId: string,
  awayTeamId: string,
): { home: number; away: number } {
  let home = 0
  let away = 0
  for (const a of actions) {
    if (!SCORING_TYPES.includes(a.type)) continue
    if (a.teamId === homeTeamId) home++
    else if (a.teamId === awayTeamId) away++
  }
  return { home, away }
}

/** Score per period (e.g. the half-time score on the scoreboard). */
export function scoreByPeriod(
  actions: Action[],
  homeTeamId: string,
  awayTeamId: string,
  periods: number,
): { home: number; away: number }[] {
  return Array.from({ length: periods }, (_, i) =>
    score(
      actions.filter((a) => a.period === i + 1),
      homeTeamId,
      awayTeamId,
    ),
  )
}

export interface GoalkeeperStats {
  playerId: string
  saves: number
  goalsConceded: number
  /** 0..1, or null when the keeper faced no shots. */
  savePercentage: number | null
  /** 7-meter shots the keeper stopped / conceded / saw go off target. */
  penaltySaves: number
  penaltyGoalsConceded: number
  penaltyMisses: number
  /** 7m stops / (7m stops + 7m goals conceded), null without 7m faced. */
  penaltySavePercentage: number | null
  /** (saves + 7m saves) / (saves + 7m saves + goals + 7m goals), or null. */
  totalSavePercentage: number | null
}

const ratio = (num: number, den: number) => (den === 0 ? null : num / den)

/**
 * Saves are credited to the player who logged them. Goals conceded and the
 * 7-meter outcomes are credited to the goalkeeper stored on the shooter's
 * action (goalkeeperId).
 */
export function goalkeeperStats(
  actions: Action[],
  goalkeeperIds: string[],
): GoalkeeperStats[] {
  return goalkeeperIds.map((playerId) => {
    const saves = actions.filter(
      (a) => a.type === 'save' && a.playerId === playerId,
    ).length
    const against = (type: ActionType) =>
      actions.filter((a) => a.type === type && a.goalkeeperId === playerId)
        .length
    const goalsConceded = against('goal')
    const penaltySaves = against('penalty_saved')
    const penaltyGoalsConceded = against('penalty_goal')
    const penaltyMisses = against('penalty_miss')
    return {
      playerId,
      saves,
      goalsConceded,
      savePercentage: ratio(saves, saves + goalsConceded),
      penaltySaves,
      penaltyGoalsConceded,
      penaltyMisses,
      penaltySavePercentage: ratio(
        penaltySaves,
        penaltySaves + penaltyGoalsConceded,
      ),
      totalSavePercentage: ratio(
        saves + penaltySaves,
        saves + penaltySaves + goalsConceded + penaltyGoalsConceded,
      ),
    }
  })
}

/** Goals (incl. 7m) with no goalkeeper credited (no active keeper was set). */
export function goalsWithoutKeeper(actions: Action[]): number {
  return actions.filter(
    (a) => SCORING_TYPES.includes(a.type) && !a.goalkeeperId,
  ).length
}

export function formatPercentage(p: number | null): string {
  return p === null ? '-' : `${Math.round(p * 100)}%`
}

/** Kept for existing callers. */
export const formatSavePercentage = formatPercentage
