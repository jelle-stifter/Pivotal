import { SCORING_TYPES } from './actions'
import {
  formatPercentage,
  shotPercentage,
  teamTotals,
  totalGoals,
  type Totals,
  emptyTotals,
} from './stats'
import type { Action } from '../types'

export interface CompareRow {
  key: string
  label: string
  home: number
  away: number
  /** Text to show instead of the raw number (percentages). */
  homeText?: string
  awayText?: string
  /** For "less is better" metrics the lower side is highlighted. */
  lowerIsBetter?: boolean
}

/** Side-by-side team numbers for the match header comparison bars. */
export function compareRows(
  actions: Action[],
  homeId: string,
  awayId: string,
): CompareRow[] {
  const t = teamTotals(actions)
  const h: Totals = t.get(homeId) ?? emptyTotals()
  const a: Totals = t.get(awayId) ?? emptyTotals()
  const sp = (x: Totals) => shotPercentage(x)
  const row = (
    key: string,
    label: string,
    f: (x: Totals) => number,
    lowerIsBetter = false,
  ): CompareRow => ({ key, label, home: f(h), away: f(a), lowerIsBetter })

  const rows: CompareRow[] = [
    row('goals', 'Doelpunten', totalGoals),
    {
      key: 'shotpct',
      label: 'Schot%',
      home: (sp(h) ?? 0) * 100,
      away: (sp(a) ?? 0) * 100,
      homeText: formatPercentage(sp(h)),
      awayText: formatPercentage(sp(a)),
    },
    row('assist', 'Assists', (x) => x.assist),
    row('save', 'Saves', (x) => x.save),
    row('interception', 'Onderscheppingen', (x) => x.interception),
    row('penalty', '7m gekregen', (x) => x.penalty_won),
    row(
      'turnover',
      'Balverlies',
      (x) => x.turnover + x.bad_pass + x.technical_foul,
      true,
    ),
    row('foul', 'Fouten', (x) => x.foul, true),
    row(
      'cards',
      'Kaarten / 2 min',
      (x) => x.yellow_card + x.suspension + x.red_card + x.blue_card,
      true,
    ),
  ]
  // Hide rows where both sides are zero: nothing to compare.
  return rows.filter((r) => r.home !== 0 || r.away !== 0)
}

export interface TimelinePoint {
  /** Match clock in ms. */
  t: number
  home: number
  away: number
}

/** Running score after every scoring action, starting at 0-0. */
export function scoreTimeline(
  actions: Action[],
  homeId: string,
  awayId: string,
): TimelinePoint[] {
  const scoring = actions
    .filter((a) => SCORING_TYPES.includes(a.type))
    .sort((a, b) => a.matchClockMs - b.matchClockMs || a.createdAt - b.createdAt)
  const out: TimelinePoint[] = [{ t: 0, home: 0, away: 0 }]
  let home = 0
  let away = 0
  for (const a of scoring) {
    if (a.teamId === homeId) home++
    else if (a.teamId === awayId) away++
    else continue
    out.push({ t: a.matchClockMs, home, away })
  }
  return out
}

export interface BiggestLead {
  home: number
  away: number
}

/** Largest lead each side had during the match. */
export function biggestLead(points: TimelinePoint[]): BiggestLead {
  let home = 0
  let away = 0
  for (const p of points) {
    home = Math.max(home, p.home - p.away)
    away = Math.max(away, p.away - p.home)
  }
  return { home, away }
}

export interface Scorer {
  playerId: string
  goals: number
  penaltyGoals: number
  total: number
}

/** Players ranked by goals (incl. 7m), most first. */
export function topScorers(actions: Action[], limit = 5): Scorer[] {
  const map = new Map<string, Scorer>()
  for (const a of actions) {
    if (!SCORING_TYPES.includes(a.type)) continue
    const s = map.get(a.playerId) ?? {
      playerId: a.playerId,
      goals: 0,
      penaltyGoals: 0,
      total: 0,
    }
    if (a.type === 'penalty_goal') s.penaltyGoals++
    else s.goals++
    s.total++
    map.set(a.playerId, s)
  }
  return [...map.values()]
    .sort((a, b) => b.total - a.total || a.playerId.localeCompare(b.playerId))
    .slice(0, limit)
}

/** A match counts as live while its latest action is under 3 hours old. */
export const LIVE_WINDOW_MS = 3 * 60 * 60 * 1000

export function liveMatchIds(
  actions: Pick<Action, 'matchId' | 'createdAt'>[],
  now: number,
  /** Matches ended by hand are never live. */
  finishedIds: ReadonlySet<string> = new Set(),
): Set<string> {
  const latest = new Map<string, number>()
  for (const a of actions)
    latest.set(a.matchId, Math.max(latest.get(a.matchId) ?? 0, a.createdAt))
  const live = new Set<string>()
  for (const [id, t] of latest)
    if (!finishedIds.has(id) && now - t >= 0 && now - t < LIVE_WINDOW_MS)
      live.add(id)
  return live
}
