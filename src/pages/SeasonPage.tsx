import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/schema'
import { KeeperTable, TotalsTable } from '../components/StatsTables'
import { seasonCsv, seasonFileName } from '../lib/csv'
import { downloadText } from '../lib/download'
import {
  filterSeasonMatches,
  matchResults,
  recordOf,
  seasonPlayerRows,
  seasonsOf,
  type ResultLetter,
} from '../lib/season'
import { goalkeeperStats, totalGoals, visibleTypes } from '../lib/stats'

const RESULT_LABEL: Record<ResultLetter, string> = {
  W: 'Winst',
  G: 'Gelijk',
  V: 'Verlies',
}
const RESULT_STYLE: Record<ResultLetter, { bg: string; fg: string }> = {
  W: { bg: '#dcfce7', fg: '#166534' },
  G: { bg: '#f1f5f9', fg: '#334155' },
  V: { bg: '#fee2e2', fg: '#991b1b' },
}

function formatDate(iso: string) {
  const [y, m, d] = iso.split('-')
  return `${d}-${m}-${y}`
}

export default function SeasonPage() {
  const teams = useLiveQuery(() => db.teams.toArray(), [])
  const players = useLiveQuery(() => db.players.toArray(), [])
  const matches = useLiveQuery(() => db.matches.toArray(), [])
  const actions = useLiveQuery(() => db.actions.toArray(), [])

  // null = automatically the newest season
  const [seasonSel, setSeasonSel] = useState<string | null>(null)
  const [teamId, setTeamId] = useState('')

  if (!teams || !players || !matches || !actions) return null

  const teamName = (id: string) => teams.find((t) => t.id === id)?.name ?? '?'
  const seasons = seasonsOf(matches)
  const season = seasonSel ?? seasons[0] ?? 'all'
  const seasonFilter = season === 'all' ? undefined : season

  const selected = filterSeasonMatches(matches, {
    season: seasonFilter,
    teamId: teamId || undefined,
  })
  const ids = new Set(selected.map((m) => m.id))
  const results = matchResults(selected, actions, teamId || undefined)
  const record = recordOf(results)
  const seasonActions = actions.filter((a) => ids.has(a.matchId))

  const playerRows = seasonPlayerRows(ids, actions).filter((r) => {
    const p = players.find((x) => x.id === r.playerId)
    return teamId === '' || p?.teamId === teamId
  })
  const byId = new Map(players.map((p) => [p.id, p]))
  const sortedRows = [...playerRows].sort((a, b) => {
    const pa = byId.get(a.playerId)
    const pb = byId.get(b.playerId)
    return (
      teamName(pa?.teamId ?? '').localeCompare(teamName(pb?.teamId ?? '')) ||
      (pa?.number ?? 0) - (pb?.number ?? 0)
    )
  })

  const keeperIds = new Set(players.filter((p) => p.isGoalkeeper).map((p) => p.id))
  for (const a of seasonActions) if (a.goalkeeperId) keeperIds.add(a.goalkeeperId)
  const keeperRows = goalkeeperStats(seasonActions, [...keeperIds])
    .filter((g) => {
      const p = byId.get(g.playerId)
      const used =
        g.saves + g.goalsConceded + g.penaltySaves + g.penaltyGoalsConceded > 0
      return used && (teamId === '' || p?.teamId === teamId)
    })
    .map((g) => {
      const p = byId.get(g.playerId)
      return {
        key: g.playerId,
        label: p ? `#${p.number} ${p.name}` : '?',
        team: p ? teamName(p.teamId) : '',
        stats: g,
      }
    })
    .sort((a, b) => a.team.localeCompare(b.team) || a.label.localeCompare(b.label))

  const teamsInMatches = [
    ...new Set(matches.flatMap((m) => [m.homeTeamId, m.awayTeamId])),
  ]
  const goalsTotal = results.reduce((s, r) => s + r.homeGoals + r.awayGoals, 0)

  function exportCsv() {
    downloadText(
      seasonFileName(seasonFilter, teamId ? teamName(teamId) : undefined),
      seasonCsv({ teams: teams!, players: players!, rows: sortedRows }),
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="page-title">
          Seizoen{season === 'all' ? '' : ` ${season}`}
          {teamId ? ` · ${teamName(teamId)}` : ''}
        </h2>
        <div className="flex gap-2 no-print">
          <button className="btn" onClick={() => window.print()}>
            Afdrukken / PDF
          </button>
          <button className="btn" onClick={exportCsv} disabled={playerRows.length === 0}>
            Spelers (CSV)
          </button>
        </div>
      </div>

      <section className="card no-print" aria-label="Filters">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="label">
            Seizoen
            <select
              className="field"
              value={season}
              onChange={(e) => setSeasonSel(e.target.value)}
            >
              <option value="all">Alle seizoenen</option>
              {seasons.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="label">
            Team
            <select
              className="field"
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
            >
              <option value="">Alle teams</option>
              {teamsInMatches.map((id) => (
                <option key={id} value={id}>
                  {teamName(id)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {selected.length === 0 ? (
        <section className="card">
          <p className="py-6 text-center text-slate-500">
            Geen wedstrijden in deze selectie. Maak een wedstrijd aan onder
            Wedstrijden of kies een ander seizoen of team.
          </p>
        </section>
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-3" aria-label="Samenvatting">
            <SummaryCard label="Wedstrijden" value={String(selected.length)} />
            {teamId ? (
              <>
                <SummaryCard
                  label="Winst – gelijk – verlies"
                  value={`${record.won} – ${record.drawn} – ${record.lost}`}
                />
                <SummaryCard
                  label="Doelpunten voor – tegen"
                  value={`${record.goalsFor} – ${record.goalsAgainst}`}
                />
              </>
            ) : (
              <SummaryCard label="Doelpunten totaal" value={String(goalsTotal)} />
            )}
          </section>

          <section className="card" aria-label="Uitslagen">
            <h3 className="section-title mb-2">Uitslagen</h3>
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Datum</th>
                    <th>Thuis</th>
                    <th>Uit</th>
                    <th className="text-center">Uitslag</th>
                    <th className="text-center">Rust</th>
                    {teamId && <th>Resultaat</th>}
                    <th className="no-print" />
                  </tr>
                </thead>
                <tbody>
                  {results.map((r) => (
                    <tr key={r.matchId}>
                      <td className="whitespace-nowrap">{formatDate(r.date)}</td>
                      <td className="font-semibold">{teamName(r.homeTeamId)}</td>
                      <td className="font-semibold">{teamName(r.awayTeamId)}</td>
                      <td className="text-center font-bold tabular-nums">
                        {r.homeGoals} – {r.awayGoals}
                      </td>
                      <td className="text-center tabular-nums text-slate-600">
                        {r.half ? `${r.half.home} – ${r.half.away}` : '–'}
                      </td>
                      {teamId && (
                        <td>
                          {r.result && (
                            <span
                              className="rounded-full px-2.5 py-0.5 text-xs font-bold"
                              style={{
                                background: RESULT_STYLE[r.result].bg,
                                color: RESULT_STYLE[r.result].fg,
                              }}
                            >
                              {RESULT_LABEL[r.result]}
                            </span>
                          )}
                        </td>
                      )}
                      <td className="no-print space-x-4 whitespace-nowrap text-right">
                        <a href={`#/match/${r.matchId}`} className="text-sm font-semibold underline">
                          Live
                        </a>
                        <a href={`#/stats/${r.matchId}`} className="text-sm font-semibold underline">
                          Statistieken
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="card" aria-label="Spelers">
            <h3 className="section-title mb-2">Spelers (totalen over {selected.length} wedstrijd{selected.length === 1 ? '' : 'en'})</h3>
            <TotalsTable
              rows={sortedRows.map((r) => {
                const p = byId.get(r.playerId)
                return {
                  key: r.playerId,
                  label: p ? `#${p.number} ${p.name}` : '?',
                  sub: p ? teamName(p.teamId) : '',
                  totals: r.totals,
                  matches: r.matches,
                }
              })}
              labelHeader="Speler"
              types={visibleTypes(sortedRows.map((r) => r.totals))}
              showTeam
              showTotal
              showMatches
            />
            <p className="mt-2 text-xs text-slate-500">
              "Wedstr." telt de wedstrijden waarin de speler minstens één actie
              heeft. Totaal goals: {sortedRows.reduce((s, r) => s + totalGoals(r.totals), 0)}.
            </p>
          </section>

          <section className="card" aria-label="Keepers">
            <h3 className="section-title mb-2">Keepers</h3>
            <KeeperTable rows={keeperRows} />
          </section>
        </>
      )}
    </div>
  )
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="card text-center">
      <div className="text-sm text-slate-600">{label}</div>
      <div className="text-3xl font-black tabular-nums">{value}</div>
    </div>
  )
}
