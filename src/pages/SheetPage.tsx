import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/schema'
import MatchReport from '../components/MatchReport'
import { KeeperGoalSection, MatchNotes, ShotsSection, TodoSection } from '../components/ReportSections'

/**
 * Match report. The report itself (front and back, printable on one A4 sheet)
 * is MatchReport. Below it, on screen only, the post-match editing: fill in
 * what was skipped, goal zones per keeper, notes and the shot cards.
 */
export default function SheetPage({ matchId }: { matchId: string }) {
  const matches = useLiveQuery(
    () => db.matches.where('id').equals(matchId).toArray(),
    [matchId],
  )
  const teams = useLiveQuery(() => db.teams.toArray(), [])
  const match = matches?.[0]
  const players = useLiveQuery(
    async () =>
      match
        ? db.players
            .where('teamId')
            .anyOf(match.homeTeamId, match.awayTeamId)
            .toArray()
        : [],
    [match?.homeTeamId, match?.awayTeamId],
  )
  const actions = useLiveQuery(
    () => db.actions.where('matchId').equals(matchId).toArray(),
    [matchId],
  )

  if (matches === undefined || !teams || !players || !actions) return null
  if (!match)
    return (
      <div className="card">
        <p>
          Wedstrijd niet gevonden.{' '}
          <a href="#/matches" className="font-semibold underline">
            Terug naar wedstrijden
          </a>
        </p>
      </div>
    )

  const teamName = (id: string) => teams.find((t) => t.id === id)?.name ?? '?'

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 no-print">
        <a href={`#/stats/${match.id}`} className="text-sm font-semibold underline">
          ← Statistieken
        </a>
        <button className="btn btn-primary" onClick={() => window.print()}>
          Afdrukken
        </button>
      </div>

      <MatchReport match={match} teams={teams} players={players} actions={actions} />

      <div className="no-print space-y-6">
        <TodoSection match={match} actions={actions} players={players} teamName={teamName} />

        <KeeperGoalSection actions={actions} players={players} />

        <MatchNotes match={match} />

        <ShotsSection
          actions={actions}
          players={players}
          teamName={teamName}
          teamIds={[match.homeTeamId, match.awayTeamId]}
        />

        <p className="text-center text-xs text-slate-400">
          Schotpercentage = totaal doelpunten / totaal schoten op doel (doelpunten + missers + 7m-doelpunt + 7m-stop +
          7m niet op doel). Gemaakt met Backhand.
        </p>
      </div>
    </div>
  )
}
