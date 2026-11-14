import { useState } from 'react'
import LiveLink from '../components/LiveLink'
import ShareButton from '../components/ShareButton'
import { matchSummary } from '../lib/summary'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/schema'
import { ACTION_META } from '../lib/actions'
import { actionsCsv, csvFileName, playerStatsCsv } from '../lib/csv'
import { downloadText } from '../lib/download'
import TeamHeat from '../components/TeamHeat'
import { FieldPlayersTable, KeepersTable } from '../components/PlayerStatTables'
import CompareBars from '../components/CompareBars'
import ScoreFlow from '../components/ScoreFlow'
import ScoreHero from '../components/ScoreHero'
import { matchColors } from '../lib/teamColors'
import { biggestLead, compareRows, scoreTimeline, topScorers } from '../lib/analysis'
import { TotalsTable } from '../components/StatsTables'
import { hasPosition } from '../lib/court'
import { isShot } from '../lib/shots'
import { hasFieldData } from '../lib/statTables'
import { periodLabels } from '../lib/periods'
import {
  filterActions,
  goalkeeperStats,
  goalsWithoutKeeper,
  playerTotals,
  score,
  scoreByPeriod,
  teamTotals,
  visibleTypes,
  emptyTotals,
} from '../lib/stats'
import {
  ACTION_TYPES,
  type ActionFilter,
  type ActionType,
  type Match,
  type Player,
  type Team,
  type Action,
} from '../types'

export default function StatsPage({ matchId }: { matchId: string }) {
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

  return (
    <StatsScreen
      key={match.id}
      match={match}
      teams={teams}
      players={players}
      actions={actions}
    />
  )
}

function StatsScreen({
  match,
  teams,
  players,
  actions,
}: {
  match: Match
  teams: Team[]
  players: Player[]
  actions: Action[]
}) {
  const teamName = (id: string) => teams.find((t) => t.id === id)?.name ?? '?'
  const [filter, setFilter] = useState<ActionFilter>({})
  const [heatView, setHeatView] = useState<'heat' | 'dots'>('heat')

  const matchTeams = [match.homeTeamId, match.awayTeamId]
  const filtered = filterActions(actions, filter)
  const result = score(actions, match.homeTeamId, match.awayTeamId)
  const timeline = scoreTimeline(actions, match.homeTeamId, match.awayTeamId)
  const lead = biggestLead(timeline)
  const scorers = topScorers(actions, 3)

  // Heatmap: the filtered actions that carry a court position (older actions
  // and keyboard-only entries have none and are simply not drawn).
  // Without an action filter the heatmap shows shots and goals only (stops and
  // turnovers lie on the own half and would blur the picture).
  const heatable = filter.type === undefined ? filtered.filter(isShot) : filtered
  const positioned = heatable.filter(hasPosition)
  const heatPlayer = filter.playerId
    ? players.find((p) => p.id === filter.playerId)
    : undefined

  const pTotals = playerTotals(filtered)
  const tTotals = teamTotals(filtered)

  // Player table: roster of the selected team(s)/player, zero rows included.
  const rosterRows = players
    .filter(
      (p) =>
        (filter.teamId === undefined || p.teamId === filter.teamId) &&
        (filter.playerId === undefined || p.id === filter.playerId),
    )
    .sort(
      (a, b) =>
        matchTeams.indexOf(a.teamId) - matchTeams.indexOf(b.teamId) ||
        a.number - b.number,
    )

  // Goalkeeper table ignores the action-type and player filters: save % needs
  // saves AND goals conceded together. Team and period filters still apply.
  const gkActions = filterActions(actions, {
    teamId: undefined,
    period: filter.period,
  })
  const gkIds = new Set(
    players.filter((p) => p.isGoalkeeper).map((p) => p.id),
  )
  for (const a of gkActions) if (a.goalkeeperId) gkIds.add(a.goalkeeperId)
  const gkPlayers = players
    .filter(
      (p) =>
        gkIds.has(p.id) &&
        (filter.teamId === undefined || p.teamId === filter.teamId),
    )
    .sort(
      (a, b) =>
        matchTeams.indexOf(a.teamId) - matchTeams.indexOf(b.teamId) ||
        a.number - b.number,
    )
  const gkRows = goalkeeperStats(
    gkActions,
    gkPlayers.map((p) => p.id),
  )
  const unassigned = goalsWithoutKeeper(gkActions)

  // Table 1 (field players): per team, everyone who is not a keeper (a keeper
  // only when there is field data), in team order; follows the filters.
  const fieldGroups = matchTeams
    .filter((id) => filter.teamId === undefined || id === filter.teamId)
    .map((id) => ({
      key: id,
      title: teamName(id),
      rows: rosterRows
        .filter((p) => p.teamId === id && (!gkIds.has(p.id) || hasFieldData(pTotals.get(p.id) ?? emptyTotals())))
        .map((p) => ({
          key: p.id,
          label: `#${p.number} ${p.name}`,
          totals: pTotals.get(p.id) ?? emptyTotals(),
        })),
    }))

  function set<K extends keyof ActionFilter>(
    key: K,
    value: ActionFilter[K] | undefined,
  ) {
    setFilter((f) => {
      const next = { ...f, [key]: value }
      // Keep player filter consistent with the team filter.
      if (key === 'teamId' && next.playerId) {
        const p = players.find((x) => x.id === next.playerId)
        if (p && value !== undefined && p.teamId !== value)
          next.playerId = undefined
      }
      return next
    })
  }

  const filterActive = Object.values(filter).some((v) => v !== undefined)

  // Exports always cover the whole match, regardless of the active filters.
  const exportData = { match, teams, players, actions }
  const exportActions = () =>
    downloadText(csvFileName(match, teams, 'acties'), actionsCsv(exportData))
  const exportPlayers = () =>
    downloadText(
      csvFileName(match, teams, 'spelers'),
      playerStatsCsv(exportData),
    )

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 no-print">
        <h2 className="page-title">Wedstrijd</h2>
        <div className="flex gap-2 text-sm font-semibold">
          <ShareButton text={matchSummary({ match, teamName, players, actions })} />
          <LiveLink matchId={match.id} className="btn inline-flex items-center no-underline">
            Live
          </LiveLink>
          <a href="#/matches" className="btn inline-flex items-center no-underline">
            ← Wedstrijden
          </a>
        </div>
      </div>

      <ScoreHero
        homeName={teamName(match.homeTeamId)}
        awayName={teamName(match.awayTeamId)}
        homeGoals={result.home}
        awayGoals={result.away}
        date={match.date}
        location={match.location}
        half={match.format === 2 && actions.some((a) => a.period >= 2) ? scoreByPeriod(actions, match.homeTeamId, match.awayTeamId, 1)[0] : null}
        homeColor={matchColors(match).home}
        awayColor={matchColors(match).away}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card" aria-label="Vergelijking">
          <h3 className="section-title mb-3">Vergelijking</h3>
          <CompareBars
            rows={compareRows(actions, match.homeTeamId, match.awayTeamId)}
            homeName={teamName(match.homeTeamId)}
            awayName={teamName(match.awayTeamId)}
            homeColor={matchColors(match).home}
            awayColor={matchColors(match).away}
          />
        </section>
        <section className="card" aria-label="Scoreverloop">
          <h3 className="section-title mb-3">Scoreverloop</h3>
          <ScoreFlow
            points={timeline}
            homeName={teamName(match.homeTeamId)}
            awayName={teamName(match.awayTeamId)}
            boundaries={match.format === 2 ? [30 * 60_000] : [20 * 60_000, 40 * 60_000]}
            homeColor={matchColors(match).home}
            awayColor={matchColors(match).away}
          />
          <h3 className="section-title mb-1 mt-5">Topscorers</h3>
          {scorers.length === 0 ? (
            <p className="text-sm text-slate-500">Nog geen doelpunten.</p>
          ) : (
            scorers.map((sc, i) => {
              const p = players.find((x) => x.id === sc.playerId)
              return (
                <a key={sc.playerId} href={`#/player/${sc.playerId}`} className="bar-row no-underline" style={{ color: 'inherit' }}>
                  <span className={`rank ${i === 0 ? 'rank-1' : ''}`}>{i + 1}</span>
                  <span className="truncate font-semibold">
                    {p ? `#${p.number} ${p.name}` : '?'}
                    <span className="block text-xs font-normal text-slate-500">{p ? teamName(p.teamId) : ''}</span>
                  </span>
                  <span className="bar-track"><span className="bar-fill block" style={{ width: `${(sc.total / scorers[0].total) * 100}%` }} /></span>
                  <span className="text-right font-bold tabular-nums">{sc.total}</span>
                </a>
              )
            })
          )}
          <p className="mt-3 text-sm text-slate-600">
            Grootste voorsprong: {teamName(match.homeTeamId)} +{lead.home},{' '}
            {teamName(match.awayTeamId)} +{lead.away}.
          </p>
        </section>
      </div>

      <section className="card no-print" aria-label="Export">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="section-title">Export</h3>
            <p className="mt-1 text-sm text-slate-600">
              CSV voor Excel, altijd de hele wedstrijd (filters tellen niet
              mee).
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href={`#/sheet/${match.id}`}
              className="btn inline-flex items-center no-underline"
            >
              Wedstrijdblad (afdrukken)
            </a>
            <button className="btn" onClick={exportActions}>
              Alle acties (CSV)
            </button>
            <button className="btn" onClick={exportPlayers}>
              Spelersstatistieken (CSV)
            </button>
          </div>
        </div>
      </section>

      <section className="card" aria-label="Filters">
        <h3 className="section-title mb-3">Filters</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="label">
            Team
            <select
              className="field"
              value={filter.teamId ?? ''}
              onChange={(e) => set('teamId', e.target.value || undefined)}
            >
              <option value="">Beide teams</option>
              {matchTeams.map((id) => (
                <option key={id} value={id}>
                  {teamName(id)}
                </option>
              ))}
            </select>
          </label>
          <label className="label">
            Speler
            <select
              className="field"
              value={filter.playerId ?? ''}
              onChange={(e) => set('playerId', e.target.value || undefined)}
            >
              <option value="">Alle spelers</option>
              {players
                .filter(
                  (p) =>
                    filter.teamId === undefined || p.teamId === filter.teamId,
                )
                .sort(
                  (a, b) =>
                    matchTeams.indexOf(a.teamId) -
                      matchTeams.indexOf(b.teamId) || a.number - b.number,
                )
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {filter.teamId === undefined
                      ? `${teamName(p.teamId)} · `
                      : ''}
                    #{p.number} {p.name}
                  </option>
                ))}
            </select>
          </label>
          <label className="label">
            Actie
            <select
              className="field"
              value={filter.type ?? ''}
              onChange={(e) =>
                set('type', (e.target.value || undefined) as ActionType | undefined)
              }
            >
              <option value="">Alle acties</option>
              {ACTION_TYPES.map((t) => (
                <option key={t} value={t}>
                  {ACTION_META[t].label}
                </option>
              ))}
            </select>
          </label>
          <label className="label">
            Periode
            <select
              className="field"
              value={filter.period ?? ''}
              onChange={(e) =>
                set('period', e.target.value ? Number(e.target.value) : undefined)
              }
            >
              <option value="">Hele wedstrijd</option>
              {periodLabels(match.format).map((l, i) => (
                <option key={l} value={i + 1}>
                  {l}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-4 flex items-center justify-between gap-3 text-sm text-slate-600">
          <span>
            {filtered.length} van {actions.length} acties
          </span>
          {filterActive && (
            <button className="btn" onClick={() => setFilter({})}>
              Wis filters
            </button>
          )}
        </div>
      </section>

      <section className="card" aria-label="Teamtotalen">
        <h3 className="section-title mb-2">Teams</h3>
        <TotalsTable
          rows={matchTeams
            .filter((id) => filter.teamId === undefined || id === filter.teamId)
            .map((id) => ({
              key: id,
              label: teamName(id),
              totals: tTotals.get(id) ?? emptyTotals(),
            }))}
          labelHeader="Team"
          types={visibleTypes(tTotals.values())}
        />
      </section>

      <section className="card" aria-label="Veldspelers">
        <h3 className="section-title mb-2">Veldspelers</h3>
        <FieldPlayersTable groups={fieldGroups} />
        <p className="mt-2 text-xs text-slate-500">
          Klik op een naam of een waarde om de rij van die speler te markeren; klik nog eens om het op te heffen. Een
          lege cel betekent: geen gegevens. Schotpercentage = totaal doelpunten / totaal schoten op doel.
        </p>
      </section>

      <section className="card space-y-3" aria-label="Heatmap">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="section-title">Heatmap</h3>
            <p className="mt-1 text-sm text-slate-600">
              {heatPlayer
                ? `#${heatPlayer.number} ${heatPlayer.name}`
                : filter.teamId
                  ? teamName(filter.teamId)
                  : 'Beide teams'}
              {' · '}
              {filter.type ? ACTION_META[filter.type].label : 'Schoten en doelpunten'}
              {filter.period
                ? ` · ${periodLabels(match.format)[filter.period - 1]}`
                : ''}
            </p>
          </div>
          <div className="segmented" role="group" aria-label="Weergave">
            {(
              [
                ['heat', 'Heatmap'],
                ['dots', 'Punten'],
              ] as const
            ).map(([v, label]) => (
              <button
                key={v}
                type="button"
                className="seg-btn"
                aria-pressed={heatView === v}
                onClick={() => setHeatView(v)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <p className="text-sm text-slate-600" aria-live="polite">
          {positioned.length} van {heatable.length} {filter.type === undefined ? 'schoten en doelpunten' : 'acties'} hebben een positie
        </p>

        {heatable.length === 0 ? (
          <p className="py-6 text-center text-slate-500">
            Geen acties voor deze filters.
          </p>
        ) : positioned.length === 0 ? (
          <p className="py-6 text-center text-slate-500">
            Geen van deze acties heeft een positie. Klik tijdens het
            registreren op het veld, of voeg achteraf een positie toe bij de
            actielijst op het live-scherm.
          </p>
        ) : (
          <div className="mx-auto max-w-3xl">
            <TeamHeat
              match={match}
              teamName={teamName}
              actions={positioned}
              view={heatView}
              label={`Heatmap van ${positioned.length} acties`}
            />
          </div>
        )}
        <p className="text-xs text-slate-500">
          Gebruikt de filters hierboven: kies een speler en een actie voor een
          persoonlijke heatmap. Het veld is altijd vanuit het aanvalsperspectief
          getekend: elk team heeft zijn eigen helft. Het team dat naar rechts aanvalt staat rechts, het andere team links.
        </p>
      </section>

      <section className="card" aria-label="Keepers">
        <h3 className="section-title mb-2">Keepers</h3>
        <KeepersTable
          rows={gkRows.map((g) => {
            const pl = players.find((x) => x.id === g.playerId)
            return {
              key: g.playerId,
              label: pl ? `#${pl.number} ${pl.name} (${teamName(pl.teamId)})` : '?',
              stats: g,
            }
          })}
        />
        {unassigned > 0 && (
          <p className="mt-3 text-sm text-amber-700">
            {unassigned} goal{unassigned === 1 ? '' : 's'} zonder toegekende
            keeper (er was toen geen keeper op het veld ingesteld). Die tellen
            niet mee in de keeperstatistieken.
          </p>
        )}
        <p className="mt-3 text-xs text-slate-500">
          De keepertabel negeert het actie- en spelerfilter, omdat stops en
          doelpunten tegen samen nodig zijn voor het percentage. Team- en
          periodefilter gelden wel. Schotpercentage = totaal stops / totaal schoten op doel.
        </p>
      </section>
    </div>
  )
}
