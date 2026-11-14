import { SCORING_TYPES } from './actions'
import type { Action, TodoField } from '../types'

export const TODO_LABEL: Record<TodoField, string> = {
  speler: 'speler',
  keeper: 'keeper',
  schutter: 'schutter',
  assist: 'assist',
  positie: 'positie',
}

/**
 * Fields that were skipped during the match ("invullen na de wedstrijd") and
 * are still empty. Filling them in (live history or report) clears the mark.
 */
export function missingFields(
  a: Pick<Action, 'todo' | 'playerId' | 'staffId' | 'goalkeeperId' | 'shooterId' | 'assistId' | 'position'>,
): TodoField[] {
  return (a.todo ?? []).filter((f) =>
    f === 'speler'
      ? !a.playerId && !a.staffId
      : f === 'keeper'
        ? !a.goalkeeperId
        : f === 'assist'
          ? !a.assistId
          : f === 'positie'
            ? !a.position
            : !a.shooterId,
  )
}

/** Chronological order of the match (game clock is continuous over the halves). */
export function byTime<T extends Pick<Action, 'matchClockMs' | 'createdAt'>>(list: T[]): T[] {
  return [...list].sort((a, b) => a.matchClockMs - b.matchClockMs || a.createdAt - b.createdAt)
}

/** The score right after each action (by action id), from the home team's point of view. */
export function runningScores(
  actions: Pick<Action, 'id' | 'type' | 'teamId' | 'matchClockMs' | 'createdAt'>[],
  homeTeamId: string,
  awayTeamId: string,
): Map<string, { home: number; away: number }> {
  const out = new Map<string, { home: number; away: number }>()
  let home = 0
  let away = 0
  for (const a of byTime(actions)) {
    if (SCORING_TYPES.includes(a.type)) {
      if (a.teamId === homeTeamId) home++
      else if (a.teamId === awayTeamId) away++
    }
    out.set(a.id, { home, away })
  }
  return out
}
