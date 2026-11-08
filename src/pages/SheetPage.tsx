import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/schema'
import { KeeperTable, TotalsTable } from '../components/StatsTables'
import {
  emptyTotals,
  goalkeeperStats,
  goalsWithoutKeeper,
  playerTotals,
  score,
  scoreByPeriod,
  visibleTypes,
} from '../lib/stats'
import { periodLabel } from '../lib/periods'

function formatDate(iso: string) {
  const [y, m, d] = iso.split('-')
  return `${d}-${m}-${y}`
}

/** Printable match sheet, modelled on the "Wedstrijdstatistieken" sheet. */
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
  const result = score(actions, match.homeTeamId, match.awayTeamId)
  const periods = scoreByPeriod(
    actions,
    match.homeTeamId,
    match.awayTeamId,
    match.format,
  )
  const totals = playerTotals(actions)
  const types = visibleTypes(totals.values())

  const gkIds = new Set(players.filter((p) => p.isGoalkeeper).map((p) => p.id))
  for (const a of actions) if (a.goalkeeperId) gkIds.add(a.goalkeeperId)
  const keeperRows = goalkeeperStats(actions, [...gkIds])
    .filter(
      (g) =>
        g.saves + g.goalsConceded + g.penaltySaves + g.penaltyGoalsConceded > 0,
    )
    .map((g) => {
      const p = players.find((x) => x.id === g.playerId)
      return {
        key: g.playerId,
        label: p ? `#${p.number} ${p.name}` : '?',
        team: p ? teamName(p.teamId) : '',
        stats: g,
      }
    })
    .sort((a, b) => a.team.localeCompare(b.team))
  const unassigned = goalsWithoutKeeper(actions)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 no-print">
        <a href={`#/stats/${match.id}`} className="text-sm font-semibold underline">
          ← Statistieken
        </a>
        <button className="btn btn-primary" onClick={() => window.print()}>
          Afdrukken / PDF
        </button>
      </div>

      <header className="card text-center">
        <div className="text-sm font-semibold uppercase tracking-widest text-slate-500">
          Wedstrijdstatistieken
        </div>
        <h2 className="mt-1 text-2xl font-black">
          {teamName(match.homeTeamId)} – {teamName(match.awayTeamId)}
        </h2>
        <div className="mt-1 text-sm text-slate-600">
          {formatDate(match.date)}
          {match.location ? ` · ${match.location}` : ''}
        </div>

        <div className="mx-auto mt-4 grid max-w-xl grid-cols-[1fr_auto_1fr] items-center gap-x-4 gap-y-1">
          <div className="text-right text-xs font-bold uppercase tracking-wider text-slate-500">
            Thuis
          </div>
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Eindstand
          </div>
          <div className="text-left text-xs font-bold uppercase tracking-wider text-slate-500">
            Uit
          </div>
          <div className="text-right text-lg font-semibold">{teamName(match.homeTeamId)}</div>
          <div className="text-4xl font-black tabular-nums">
            {result.home} – {result.away}
          </div>
          <div className="text-left text-lg font-semibold">{teamName(match.awayTeamId)}</div>
        </div>

        <div className="mt-3 flex flex-wrap justify-center gap-x-6 gap-y-1 text-sm text-slate-600">
          {periods.map((p, i) => (
            <span key={i}>
              {periodLabel(match.format, i + 1)}:{' '}
              <strong className="tabular-nums">
                {p.home} – {p.away}
              </strong>
            </span>
          ))}
        </div>
      </header>

      {[match.homeTeamId, match.awayTeamId].map((tid) => (
        <section key={tid} className="card" aria-label={teamName(tid)}>
          <h3 className="section-title mb-2">{teamName(tid)}</h3>
          <TotalsTable
            labelHeader="Speler"
            types={types}
            showTotal
            rows={players
              .filter((p) => p.teamId === tid)
              .sort((a, b) => a.number - b.number)
              .map((p) => ({
                key: p.id,
                label: `#${p.number} ${p.name}`,
                totals: totals.get(p.id) ?? emptyTotals(),
              }))}
          />
        </section>
      ))}

      <section className="card" aria-label="Keepers">
        <h3 className="section-title mb-2">Keepers</h3>
        <KeeperTable rows={keeperRows} />
        {unassigned > 0 && (
          <p className="mt-2 text-xs text-amber-700">
            {unassigned} goal{unassigned === 1 ? '' : 's'} zonder toegekende keeper
            tellen niet mee in de keeperstatistieken.
          </p>
        )}
      </section>

      <p className="text-center text-xs text-slate-400">
        Schot% = (goals + 7m-goals) / (goals + missers + 7m-goals + 7m gestopt +
        7m niet op doel). Gemaakt met Pivotal.
      </p>
    </div>
  )
}
