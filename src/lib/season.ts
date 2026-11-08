import { emptyTotals, score, scoreByPeriod, type Totals } from './stats'
import type { Action, Match } from '../types'

/**
 * Handball season runs August to July: 2020-09-12 and 2021-03-01 are both
 * season "2020-2021". Input is an ISO date (yyyy-mm-dd).
 */
export function seasonOf(date: string): string {
  const [y, m] = date.split('-').map(Number)
  return m >= 8 ? `${y}-${y + 1}` : `${y - 1}-${y}`
}

/** Distinct seasons present in the matches, newest first. */
export function seasonsOf(matches: Pick<Match, 'date'>[]): string[] {
  return [...new Set(matches.map((m) => seasonOf(m.date)))].sort().reverse()
}

export interface SeasonFilter {
  /** e.g. "2020-2021"; undefined = all seasons */
  season?: string
  /** only matches where this team played; undefined = all teams */
  teamId?: string
}

export function filterSeasonMatches(
  matches: Match[],
  { season, teamId }: SeasonFilter,
): Match[] {
  return matches
    .filter(
      (m) =>
        (season === undefined || seasonOf(m.date) === season) &&
        (teamId === undefined ||
          m.homeTeamId === teamId ||
          m.awayTeamId === teamId),
    )
    .sort((a, b) => a.date.localeCompare(b.date))
}

export interface PlayerSeasonRow {
  playerId: string
  /** Matches in which the player has at least one recorded action. */
  matches: number
  totals: Totals
}

/** Totals per player over the given matches only. */
export function seasonPlayerRows(
  matchIds: Set<string>,
  actions: Action[],
): PlayerSeasonRow[] {
  const rows = new Map<string, { totals: Totals; matches: Set<string> }>()
  for (const a of actions) {
    if (!matchIds.has(a.matchId)) continue
    const r = rows.get(a.playerId) ?? {
      totals: emptyTotals(),
      matches: new Set<string>(),
    }
    r.totals[a.type]++
    r.matches.add(a.matchId)
    rows.set(a.playerId, r)
  }
  return [...rows.entries()].map(([playerId, r]) => ({
    playerId,
    matches: r.matches.size,
    totals: r.totals,
  }))
}

export type ResultLetter = 'W' | 'G' | 'V' // winst, gelijk, verlies

export interface MatchResult {
  matchId: string
  date: string
  homeTeamId: string
  awayTeamId: string
  homeGoals: number
  awayGoals: number
  /** Half-time score; only for matches played in 2 halves. */
  half: { home: number; away: number } | null
  /** From the point of view of `teamId`, when one was given. */
  result?: ResultLetter
  goalsFor?: number
  goalsAgainst?: number
}

export function matchResults(
  matches: Match[],
  actions: Action[],
  teamId?: string,
): MatchResult[] {
  return matches.map((m) => {
    const own = actions.filter((a) => a.matchId === m.id)
    const s = score(own, m.homeTeamId, m.awayTeamId)
    const half =
      m.format === 2 && own.some((a) => a.period >= 2)
        ? scoreByPeriod(own, m.homeTeamId, m.awayTeamId, 1)[0]
        : null
    const r: MatchResult = {
      matchId: m.id,
      date: m.date,
      homeTeamId: m.homeTeamId,
      awayTeamId: m.awayTeamId,
      homeGoals: s.home,
      awayGoals: s.away,
      half,
    }
    if (teamId !== undefined) {
      const isHome = m.homeTeamId === teamId
      r.goalsFor = isHome ? s.home : s.away
      r.goalsAgainst = isHome ? s.away : s.home
      r.result =
        r.goalsFor > r.goalsAgainst ? 'W' : r.goalsFor < r.goalsAgainst ? 'V' : 'G'
    }
    return r
  })
}

export interface SeasonRecord {
  played: number
  won: number
  drawn: number
  lost: number
  goalsFor: number
  goalsAgainst: number
}

/** Win/draw/loss record; only meaningful for results with a team's view. */
export function recordOf(results: MatchResult[]): SeasonRecord {
  const rec: SeasonRecord = {
    played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0,
  }
  for (const r of results) {
    if (r.result === undefined) continue
    rec.played++
    if (r.result === 'W') rec.won++
    else if (r.result === 'G') rec.drawn++
    else rec.lost++
    rec.goalsFor += r.goalsFor ?? 0
    rec.goalsAgainst += r.goalsAgainst ?? 0
  }
  return rec
}
