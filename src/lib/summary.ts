import type { Action, Match, Player } from '../types'
import { topScorers } from './analysis'
import { periodLabels } from './periods'
import { score, scoreByPeriod } from './stats'

function formatDate(iso: string) {
  const [y, m, d] = iso.split('-')
  return `${d}-${m}-${y}`
}

/**
 * A short text of the match to paste in the team chat (WhatsApp etc.):
 * result, period scores and top scorers.
 */
export function matchSummary(input: {
  match: Match
  teamName: (id: string) => string
  players: Player[]
  actions: Action[]
}): string {
  const { match, teamName, players, actions } = input
  const home = teamName(match.homeTeamId)
  const away = teamName(match.awayTeamId)
  const s = score(actions, match.homeTeamId, match.awayTeamId)
  const finished = Boolean(match.finishedAt)

  const lines = [`🤾 ${home} ${s.home} – ${s.away} ${away}`]
  lines.push(
    [finished ? 'Eindstand' : 'Tussenstand', formatDate(match.date), match.location]
      .filter(Boolean)
      .join(' · '),
  )

  // Period scores, only for periods that have been played.
  if (match.currentPeriod > 1 || finished) {
    const played = scoreByPeriod(actions, match.homeTeamId, match.awayTeamId, match.format).slice(
      0,
      Math.max(match.currentPeriod, 1),
    )
    const labels = periodLabels(match.format)
    const text =
      match.format === 2 && played.length >= 1
        ? `Rust: ${played[0].home} – ${played[0].away}`
        : played.map((p, i) => `${labels[i]}: ${p.home} – ${p.away}`).join(' · ')
    lines.push(text)
  }

  const scorers = topScorers(actions, 3)
    .map((sc) => {
      const p = players.find((x) => x.id === sc.playerId)
      return p ? `${p.name} (${sc.total})` : null
    })
    .filter((x): x is string => x !== null)
  if (scorers.length > 0) lines.push(`Topscorers: ${scorers.join(', ')}`)

  lines.push('Gemaakt met Backhand')
  return lines.join('\n')
}
