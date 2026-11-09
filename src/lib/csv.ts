import { hasPosition } from './court'
import type { PlayerSeasonRow } from './season'
import { formatClock } from './time'
import { CORE_TYPES } from './actions'
import {
  emptyTotals,
  goalkeeperStats,
  playerTotals,
  shotPercentage,
  totalGoals,
} from './stats'
import {
  ACTION_TYPES,
  type Action,
  type Match,
  type Player,
  type Team,
} from '../types'

/** Dutch Excel uses ';' as list separator; a ',' file opens in one column. */
export const CSV_DELIMITER = ';'
const BOM = '﻿'

/**
 * Escape one cell: quote when needed and neutralise spreadsheet formulas
 * (a leading = + - @ would otherwise be executed by Excel).
 */
export function csvCell(value: string | number | boolean | null | undefined, delimiter = CSV_DELIMITER): string {
  if (value === null || value === undefined) return ''
  let s = String(value)
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`
  if (s.includes('"') || s.includes('\n') || s.includes('\r') || s.includes(delimiter))
    s = `"${s.replace(/"/g, '""')}"`
  return s
}

/** UTF-8 with BOM and CRLF line endings, as Excel expects. */
export function toCsv(
  headers: string[],
  rows: (string | number | boolean | null | undefined)[][],
  delimiter = CSV_DELIMITER,
): string {
  const lines = [headers, ...rows].map((r) =>
    r.map((c) => csvCell(c, delimiter)).join(delimiter),
  )
  return BOM + lines.join('\r\n') + '\r\n'
}

interface MatchData {
  match: Match
  teams: Team[]
  players: Player[]
  actions: Action[]
}

const teamName = (teams: Team[], id: string) =>
  teams.find((t) => t.id === id)?.name ?? ''

/** One row per action, in match order. */
export function actionsCsv({ match, teams, players, actions }: MatchData): string {
  const byId = new Map(players.map((p) => [p.id, p]))
  const sorted = [...actions].sort(
    (a, b) => a.matchClockMs - b.matchClockMs || a.createdAt - b.createdAt,
  )
  return toCsv(
    [
      'date',
      'home_team',
      'away_team',
      'period',
      'match_time',
      'team',
      'shirt_number',
      'player',
      'action',
      'goalkeeper_conceded',
      // Attack-normalized court position as whole percentages (0-100): the
      // acting team attacks towards x=100. Whole numbers avoid decimal-comma
      // trouble in Dutch Excel. Empty when no position was recorded.
      'court_x_pct',
      'court_y_pct',
    ],
    sorted.map((a) => {
      const p = byId.get(a.playerId)
      return [
        match.date,
        teamName(teams, match.homeTeamId),
        teamName(teams, match.awayTeamId),
        a.period,
        formatClock(a.matchClockMs),
        teamName(teams, a.teamId),
        p?.number ?? '',
        p?.name ?? '',
        a.type,
        a.goalkeeperId ? (byId.get(a.goalkeeperId)?.name ?? '') : '',
        hasPosition(a) ? Math.round(a.x * 100) : '',
        hasPosition(a) ? Math.round(a.y * 100) : '',
      ]
    }),
  )
}

/**
 * One row per player with action totals; keepers also get save stats.
 * The first columns (up to save_percentage) are unchanged from the first
 * version of this export; everything new is appended after them.
 */
export function playerStatsCsv({ match, teams, players, actions }: MatchData): string {
  const totals = playerTotals(actions)
  const order = [match.homeTeamId, match.awayTeamId]
  const sorted = [...players].sort(
    (a, b) =>
      order.indexOf(a.teamId) - order.indexOf(b.teamId) || a.number - b.number,
  )
  const gk = new Map(
    goalkeeperStats(
      actions,
      sorted.filter((p) => p.isGoalkeeper).map((p) => p.id),
    ).map((g) => [g.playerId, g]),
  )
  const extraTypes = ACTION_TYPES.filter((t) => !CORE_TYPES.includes(t))
  const pct = (p: number | null | undefined) =>
    p === null || p === undefined ? '' : Math.round(p * 100)
  return toCsv(
    [
      'team',
      'shirt_number',
      'player',
      'is_goalkeeper',
      ...CORE_TYPES,
      'goals_conceded',
      'save_percentage',
      // appended in the Lions 2 extension
      ...extraTypes,
      'total_goals',
      'shot_percentage',
      'penalty_saves',
      'penalty_goals_conceded',
      'penalty_save_percentage',
      'total_save_percentage',
    ],
    sorted.map((p) => {
      const t = totals.get(p.id) ?? emptyTotals()
      const g = gk.get(p.id)
      return [
        teamName(teams, p.teamId),
        p.number,
        p.name,
        p.isGoalkeeper ? 'yes' : 'no',
        ...CORE_TYPES.map((type) => t[type]),
        g ? g.goalsConceded : '',
        pct(g?.savePercentage),
        ...extraTypes.map((type) => t[type]),
        totalGoals(t),
        pct(shotPercentage(t)),
        g ? g.penaltySaves : '',
        g ? g.penaltyGoalsConceded : '',
        pct(g?.penaltySavePercentage),
        pct(g?.totalSavePercentage),
      ]
    }),
  )
}

/** Season totals: one row per player over the selected matches. */
export function seasonCsv({
  teams,
  players,
  rows,
}: {
  teams: Team[]
  players: Player[]
  rows: PlayerSeasonRow[]
}): string {
  const byId = new Map(players.map((p) => [p.id, p]))
  const sorted = [...rows].sort((a, b) => {
    const pa = byId.get(a.playerId)
    const pb = byId.get(b.playerId)
    return (
      teamName(teams, pa?.teamId ?? '').localeCompare(teamName(teams, pb?.teamId ?? '')) ||
      (pa?.number ?? 0) - (pb?.number ?? 0)
    )
  })
  const pct = (p: number | null) => (p === null ? '' : Math.round(p * 100))
  return toCsv(
    [
      'team', 'shirt_number', 'player', 'is_goalkeeper', 'matches',
      ...ACTION_TYPES, 'total_goals', 'shot_percentage',
    ],
    sorted.map((r) => {
      const p = byId.get(r.playerId)
      return [
        teamName(teams, p?.teamId ?? ''),
        p?.number ?? '',
        p?.name ?? '',
        p?.isGoalkeeper ? 'yes' : 'no',
        r.matches,
        ...ACTION_TYPES.map((type) => r.totals[type]),
        totalGoals(r.totals),
        pct(shotPercentage(r.totals)),
      ]
    }),
  )
}

const slugify = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

/** e.g. pivotal-seizoen-2020-2021-Lions-2.csv or ...-alle-seizoenen.csv */
export function seasonFileName(season: string | undefined, teamName?: string): string {
  return ['backhand', 'seizoen', season ?? 'alle-seizoenen', teamName ? slugify(teamName) : '']
    .filter(Boolean)
    .join('-') + '.csv'
}

/** Safe file name: letters, digits, dash. */
export function csvFileName(match: Match, teams: Team[], kind: string): string {
  const slug = (s: string) =>
    s
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
  return `backhand-${slug(teamName(teams, match.homeTeamId))}-${slug(
    teamName(teams, match.awayTeamId),
  )}-${match.date}-${kind}.csv`
}
