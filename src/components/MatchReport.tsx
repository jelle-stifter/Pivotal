import CompareBars from './CompareBars'
import ScoreFlow from './ScoreFlow'
import TeamHeat from './TeamHeat'
import { FieldPlayersTable, KeepersTable } from './PlayerStatTables'
import { biggestLead, compareRows, scoreTimeline, topScorers } from '../lib/analysis'
import { hasPosition } from '../lib/court'
import { isShot } from '../lib/shots'
import { opponentTeamId, ownTeamId } from '../lib/ownTeam'
import { periodLabel } from '../lib/periods'
import { reportScale } from '../lib/reportLayout'
import { hasFieldData } from '../lib/statTables'
import { emptyTotals, goalkeeperStats, playerTotals, score, scoreByPeriod } from '../lib/stats'
import { matchColors, textOn } from '../lib/teamColors'
import type { Action, Match, Player, Team } from '../types'

function formatDate(iso: string) {
  const [y, m, d] = iso.split('-')
  return `${d}-${m}-${y}`
}

/**
 * The match report: one A4 front side and one back side.
 * Front, top to bottom: match + score, comparison, score flow, keepers,
 * then per team the top 3 scorers and the field players table.
 * Back: the heatmap. On screen the same order is shown as two cards.
 */
export default function MatchReport({
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
  const colors = matchColors(match)
  const colorOf = (id: string) => (id === match.homeTeamId ? colors.home : colors.away)
  const result = score(actions, match.homeTeamId, match.awayTeamId)
  const periods = scoreByPeriod(actions, match.homeTeamId, match.awayTeamId, match.format)
  const timeline = scoreTimeline(actions, match.homeTeamId, match.awayTeamId)
  const lead = biggestLead(timeline)
  const totals = playerTotals(actions)

  // Keepers: anyone marked as keeper plus every keeper credited on an action.
  const gkIds = new Set(players.filter((p) => p.isGoalkeeper).map((p) => p.id))
  for (const a of actions) if (a.goalkeeperId) gkIds.add(a.goalkeeperId)
  const order = [match.homeTeamId, match.awayTeamId]
  const keeperRows = goalkeeperStats(actions, [...gkIds])
    .map((g) => ({ g, p: players.find((x) => x.id === g.playerId) }))
    .filter(({ p }) => p !== undefined)
    .sort((a, b) => order.indexOf(a.p!.teamId) - order.indexOf(b.p!.teamId) || a.p!.number - b.p!.number)
    .map(({ g, p }) => ({
      key: g.playerId,
      label: `#${p!.number} ${p!.name} (${teamName(p!.teamId)})`,
      stats: g,
    }))

  // Own team first, then the opponent.
  const teamOrder = [ownTeamId(match), opponentTeamId(match)]
  const teamBlocks = teamOrder.map((id) => {
    const rows = players
      .filter((p) => p.teamId === id && (!gkIds.has(p.id) || hasFieldData(totals.get(p.id) ?? emptyTotals())))
      .sort((a, b) => a.number - b.number)
      .map((p) => ({ key: p.id, label: `#${p.number} ${p.name}`, totals: totals.get(p.id) ?? emptyTotals() }))
    const top = topScorers(
      actions.filter((a) => a.teamId === id),
      3,
    ).map((s) => {
      const p = players.find((x) => x.id === s.playerId)
      return { id: s.playerId, label: p ? `#${p.number} ${p.name}` : '?', total: s.total }
    })
    return { id, rows, top }
  })

  // The heatmap is about shots and goals (not stops or turnovers).
  const shots = actions.filter(isShot)
  const positioned = shots.filter(hasPosition)

  // The front must fit on one A4: with many players the page is scaled down
  // when printing (estimate in mm: fixed blocks + about 3.6 mm per table row).
  const rowCount = keeperRows.length + teamBlocks.reduce((n, b) => n + b.rows.length, 0)
  const frontScale = reportScale(rowCount)
  const chip = (id: string) => (
    <span
      className="report-chip"
      style={{ background: colorOf(id), color: textOn(colorOf(id)) }}
    >
      {teamName(id)}
    </span>
  )

  return (
    <div className="report-sheet space-y-6">
      {/* ---------- Front ---------- */}
      <section
        className="report-page report-front card"
        aria-label="Rapport, voorkant"
        style={{ ['--report-scale' as string]: frontScale }}
      >
        <header className="report-head">
          <div className="report-title">Wedstrijdrapport</div>
          <div className="report-score">
            {chip(match.homeTeamId)}
            <strong className="report-result">
              {result.home} – {result.away}
            </strong>
            {chip(match.awayTeamId)}
          </div>
          <div className="report-meta">
            {formatDate(match.date)}
            {match.location ? ` · ${match.location}` : ''}
            {periods.map((p, i) => (
              <span key={i}>
                {' · '}
                {periodLabel(match.format, i + 1)} {p.home} – {p.away}
              </span>
            ))}
          </div>
        </header>

        <div className="report-block">
          <h3 className="report-h">Vergelijking</h3>
          <div className="report-compare">
            <CompareBars
              rows={compareRows(actions, match.homeTeamId, match.awayTeamId)}
              homeName={teamName(match.homeTeamId)}
              awayName={teamName(match.awayTeamId)}
              homeColor={colors.home}
              awayColor={colors.away}
            />
          </div>
        </div>

        <div className="report-block">
          <h3 className="report-h">Scoreverloop</h3>
          <div className="report-flow">
            <ScoreFlow
              points={timeline}
              homeName={teamName(match.homeTeamId)}
              awayName={teamName(match.awayTeamId)}
              boundaries={match.format === 2 ? [30 * 60_000] : [20 * 60_000, 40 * 60_000]}
              homeColor={colors.home}
              awayColor={colors.away}
            />
          </div>
          <p className="report-note">
            Grootste voorsprong: {teamName(match.homeTeamId)} +{lead.home}, {teamName(match.awayTeamId)} +{lead.away}.
          </p>
        </div>

        <div className="report-block">
          <h3 className="report-h">Keepers</h3>
          <KeepersTable rows={keeperRows} label="Keepers" />
        </div>

        {teamBlocks.map((b) => (
          <div key={b.id} className="report-block">
            <h3 className="report-h report-team">
              {chip(b.id)}
              <span className="report-top">
                Top 3 doelpunten:{' '}
                {b.top.length === 0
                  ? 'nog geen'
                  : b.top.map((t, i) => (
                      <span key={t.id}>
                        {i > 0 ? ', ' : ''}
                        {i + 1}. {t.label} ({t.total})
                      </span>
                    ))}
              </span>
            </h3>
            <FieldPlayersTable groups={[{ key: b.id, rows: b.rows }]} label={`Veldspelers ${teamName(b.id)}`} />
          </div>
        ))}
      </section>

      {/* ---------- Back ---------- */}
      <section className="report-page report-back card" aria-label="Rapport, achterkant">
        <header className="report-head">
          <div className="report-title">Heatmap: schoten en doelpunten per positie</div>
          <div className="report-score">
            {chip(match.homeTeamId)}
            <strong className="report-result">
              {result.home} – {result.away}
            </strong>
            {chip(match.awayTeamId)}
          </div>
        </header>
        {positioned.length === 0 ? (
          <p className="py-6 text-center text-slate-500">Geen schoten met een positie.</p>
        ) : (
          <TeamHeat match={match} teamName={teamName} actions={positioned} label="Heatmap van beide teams" />
        )}
        <p className="report-note">
          {positioned.length} van {shots.length} schoten en doelpunten hebben een positie. Elk team staat op zijn eigen
          helft: hoe donkerder, hoe meer schoten vanaf die plek.
        </p>
      </section>
    </div>
  )
}
