import type { Action, PositionCode } from '../types'
import { SCORING_TYPES } from './actions'
import { bestPosition } from './positions'

export interface ScorerRow {
  playerId: string
  goals: number
  /** Goals plus shots on the keeper: the denominator of the percentage. */
  onTarget: number
  /** 0..1 */
  pct: number
  /** Where most of this player's goals came from (not the playing position). */
  topPosition?: PositionCode
}

const ON_TARGET: Action['type'][] = ['goal', 'penalty_goal', 'shot', 'penalty_saved']

/**
 * Top scorers of one team for the side panel: goals / shots on goal, the
 * percentage and the position with the most goals. Players without a goal
 * are left out.
 */
export function topScorerRows(actions: Action[], teamId: string, limit = 6): ScorerRow[] {
  const byPlayer = new Map<string, Action[]>()
  for (const a of actions) {
    if (a.teamId !== teamId || !a.playerId) continue
    const list = byPlayer.get(a.playerId) ?? []
    list.push(a)
    byPlayer.set(a.playerId, list)
  }
  const rows: ScorerRow[] = []
  for (const [playerId, list] of byPlayer) {
    const goals = list.filter((a) => SCORING_TYPES.includes(a.type)).length
    if (goals === 0) continue
    const onTarget = list.filter((a) => ON_TARGET.includes(a.type)).length
    rows.push({
      playerId,
      goals,
      onTarget,
      pct: onTarget === 0 ? 0 : goals / onTarget,
      topPosition: bestPosition(list),
    })
  }
  return rows
    .sort((a, b) => b.goals - a.goals || b.pct - a.pct || a.playerId.localeCompare(b.playerId))
    .slice(0, limit)
}

/** A match has started once the clock has run or an action is logged; the preparation is then closed. */
export function matchStarted(
  match: { clockMs: number; clockStartedAt?: number; finishedAt?: number },
  actionCount: number,
): boolean {
  return actionCount > 0 || match.clockMs > 0 || match.clockStartedAt !== undefined || Boolean(match.finishedAt)
}
