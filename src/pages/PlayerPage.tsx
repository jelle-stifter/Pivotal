import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/schema'
import Court from '../components/Court'
import { ACTION_META } from '../lib/actions'
import { hasPosition } from '../lib/court'
import { heatGrid } from '../lib/heat'
import {
  emptyTotals,
  formatPercentage,
  goalkeeperStats,
  playerTotals,
  shotPercentage,
  totalGoals,
} from '../lib/stats'
import { ACTION_TYPES, type ActionType } from '../types'

function formatDate(iso: string) {
  const [y, m, d] = iso.split('-')
  return `${d}-${m}-${y}`
}

export default function PlayerPage({ playerId }: { playerId: string }) {
  const player = useLiveQuery(() => db.players.get(playerId), [playerId])
  const teams = useLiveQuery(() => db.teams.toArray(), [])
  const matches = useLiveQuery(() => db.matches.toArray(), [])
  const actions = useLiveQuery(() => db.actions.toArray(), [])
  const [type, setType] = useState<ActionType | ''>('goal')

  if (!teams || !matches || !actions) return null
  if (!player)
    return (
      <div className="card">
        <p>
          Speler niet gevonden.{' '}
          <a href="#/teams" className="font-semibold underline">
            Naar teams
          </a>
        </p>
      </div>
    )

  const teamName = (id: string) => teams.find((t) => t.id === id)?.name ?? '?'
  const own = actions.filter((a) => a.playerId === player.id)
  const totals = playerTotals(own).get(player.id) ?? emptyTotals()
  const matchIds = [...new Set(own.map((a) => a.matchId))]
  const played = matches
    .filter((m) => matchIds.includes(m.id))
    .sort((a, b) => b.date.localeCompare(a.date))

  const gk = goalkeeperStats(actions, [player.id])[0]
  const isKeeper =
    player.isGoalkeeper || gk.saves + gk.goalsConceded + gk.penaltySaves > 0

  const shown = type === '' ? own : own.filter((a) => a.type === type)
  const positioned = shown.filter(hasPosition)

  const perMatch = played.map((m) => {
    const t = playerTotals(own.filter((a) => a.matchId === m.id)).get(player.id) ?? emptyTotals()
    const opponent = m.homeTeamId === player.teamId ? m.awayTeamId : m.homeTeamId
    return { m, t, opponent }
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="page-title">
            #{player.number} {player.name}
          </h2>
          <p className="page-sub">
            {teamName(player.teamId)}
            {player.position ? ` · ${player.position}` : ''}
            {isKeeper ? ' · keeper' : ''}
          </p>
        </div>
        <a href="#/season" className="text-sm font-semibold underline">
          ← Seizoen
        </a>
      </div>

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4" aria-label="Samenvatting">
        <div className="tile">
          <div className="tile-label">Wedstrijden</div>
          <div className="tile-value">{played.length}</div>
          <div className="tile-sub">met minstens één actie</div>
        </div>
        <div className="tile">
          <div className="tile-label">Goals</div>
          <div className="tile-value">{totalGoals(totals)}</div>
          <div className="tile-sub">
            {played.length > 0
              ? `${(totalGoals(totals) / played.length).toFixed(1)} per wedstrijd`
              : ' '}
          </div>
        </div>
        <div className="tile">
          <div className="tile-label">Schot%</div>
          <div className="tile-value">{formatPercentage(shotPercentage(totals))}</div>
          <div className="tile-sub">incl. 7 meter</div>
        </div>
        {isKeeper ? (
          <div className="tile">
            <div className="tile-label">Stop%</div>
            <div className="tile-value">{formatPercentage(gk.totalSavePercentage)}</div>
            <div className="tile-sub">
              {gk.saves + gk.penaltySaves} stops · {gk.goalsConceded + gk.penaltyGoalsConceded} tegen
            </div>
          </div>
        ) : (
          <div className="tile">
            <div className="tile-label">Assists</div>
            <div className="tile-value">{totals.assist}</div>
            <div className="tile-sub">{totals.turnover + totals.bad_pass} balverlies</div>
          </div>
        )}
      </section>

      <section className="card space-y-3" aria-label="Heatmap">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="section-title">Heatmap</h3>
          <label className="label flex-row items-center gap-2">
            Actie
            <select
              className="field"
              value={type}
              onChange={(e) => setType(e.target.value as ActionType | '')}
            >
              <option value="">Alle acties</option>
              {ACTION_TYPES.map((t) => (
                <option key={t} value={t}>
                  {ACTION_META[t].label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="text-sm text-slate-600">
          {positioned.length} van {shown.length} acties hebben een positie
        </p>
        {positioned.length === 0 ? (
          <p className="py-6 text-center text-slate-500">Geen acties met positie.</p>
        ) : (
          <div className="mx-auto max-w-3xl">
            <Court
              label={`Heatmap van ${player.name}`}
              heat={heatGrid(positioned)}
            />
            <p className="mt-2 text-xs text-slate-500">
              Alle wedstrijden samen, vanuit aanvalsperspectief (doel rechts).
            </p>
          </div>
        )}
      </section>

      <section className="card" aria-label="Per wedstrijd">
        <h3 className="section-title mb-2">Per wedstrijd</h3>
        {perMatch.length === 0 ? (
          <p className="py-6 text-center text-slate-500">Nog geen acties.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table stats-table">
              <thead>
                <tr>
                  <th>Datum</th>
                  <th>Tegenstander</th>
                  <th className="text-right">Goals</th>
                  <th className="text-right">Schot%</th>
                  <th className="text-right">Assist</th>
                  <th className="text-right">Balverlies</th>
                  <th className="text-right">Save</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {perMatch.map(({ m, t, opponent }) => (
                  <tr key={m.id}>
                    <td>{formatDate(m.date)}</td>
                    <td className="font-semibold">{teamName(opponent)}</td>
                    <td className="text-right tabular-nums">{totalGoals(t)}</td>
                    <td className="text-right tabular-nums">{formatPercentage(shotPercentage(t))}</td>
                    <td className="text-right tabular-nums">{t.assist}</td>
                    <td className="text-right tabular-nums">{t.turnover + t.bad_pass}</td>
                    <td className="text-right tabular-nums">{t.save}</td>
                    <td className="text-right">
                      <a href={`#/stats/${m.id}`} className="text-sm font-semibold underline">
                        Statistieken
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
