import { Fragment, useState, type FormEvent } from 'react'
import { useNow } from '../hooks/useNow'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/schema'
import { repo } from '../db/repo'
import { DEMO_MATCH_ID } from '../lib/demo'
import { score } from '../lib/stats'
import { liveMatchIds } from '../lib/analysis'
import LiveLink from '../components/LiveLink'
import { matchStarted } from '../lib/live'
import ScorerPicker from '../components/ScorerPicker'
import { useMemberships } from '../hooks/useAccess'
import { isViewerOnly } from '../lib/access'
import MatchPrep from '../components/MatchPrep'
import type { Side } from '../types'
import {
  DEFAULT_OPPONENT_HEX,
  DEFAULT_OWN_HEX,
  TEAM_COLORS,
  colorsTooClose,
} from '../lib/teamColors'

/** Pick a team colour from the palette (main colours and darker/lighter variants). */
function ColorPicker({
  legend,
  value,
  onChange,
}: {
  legend: string
  value: string
  onChange: (hex: string) => void
}) {
  return (
    <fieldset>
      <legend className="label mb-1">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {TEAM_COLORS.map((c) => (
          <button
            key={c.hex}
            type="button"
            title={c.name}
            aria-label={c.name}
            aria-pressed={value === c.hex}
            onClick={() => onChange(c.hex)}
            className="h-11 w-11 rounded-full border border-slate-300"
            style={{
              background: c.hex,
              outline: value === c.hex ? '3px solid #111827' : 'none',
              outlineOffset: 2,
            }}
          />
        ))}
      </div>
    </fieldset>
  )
}

function today() {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function formatDate(iso: string) {
  const [y, m, d] = iso.split('-')
  return `${d}-${m}-${y}`
}

export default function MatchesPage() {
  const teams = useLiveQuery(() => db.teams.orderBy('name').toArray(), [])
  const matches = useLiveQuery(
    () => db.matches.orderBy('date').reverse().toArray(),
    [],
  )
  const actions = useLiveQuery(() => db.actions.toArray(), [])
  // Re-evaluated every minute so a match drops out of "live" by itself.
  const now = useNow(60_000)
  const { list: memberships } = useMemberships()
  // A normal player only reads: no creating, deleting or demo data.
  const viewerOnly = isViewerOnly(memberships)

  const [homeId, setHomeId] = useState('')
  const [awayId, setAwayId] = useState('')
  const [date, setDate] = useState(today())
  const [location, setLocation] = useState('')
  const [time, setTime] = useState('')
  const [ownSide, setOwnSide] = useState<Side>('home')
  const [homeColor, setHomeColor] = useState(DEFAULT_OWN_HEX)
  const [awayColor, setAwayColor] = useState(DEFAULT_OPPONENT_HEX)
  const [prepId, setPrepId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const teamName = (id: string) => teams?.find((t) => t.id === id)?.name ?? '?'

  async function create(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (!homeId || !awayId) return setError('Kies een thuis- en een uitteam.')
    if (!date) return setError('Kies een datum.')
    if (
      colorsTooClose(homeColor, awayColor) &&
      !confirm('De teamkleuren lijken erg op elkaar. Ben je zeker?')
    )
      return
    try {
      await repo.addMatch({
        homeTeamId: homeId,
        awayTeamId: awayId,
        date,
        time: time || undefined,
        location: location.trim() || undefined,
        ownSide,
        homeColor,
        awayColor,
      })
      setHomeId('')
      setAwayId('')
      setLocation('')
      setTime('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Er ging iets mis')
    }
  }

  async function remove(id: string, label: string) {
    if (!confirm(`Wedstrijd "${label}" en alle acties verwijderen?`)) return
    setError('')
    try {
      await repo.deleteMatch(id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Er ging iets mis')
    }
  }

  const needTeams = teams !== undefined && teams.length < 2
  const empty =
    teams !== undefined &&
    matches !== undefined &&
    teams.length === 0 &&
    matches.length === 0

  const live = liveMatchIds(
    actions ?? [],
    now,
    new Set((matches ?? []).filter((m) => m.finishedAt).map((m) => m.id)),
  )
  const hasDemo = matches?.some((m) => m.id === DEMO_MATCH_ID) ?? false

  async function loadDemo() {
    setError('')
    try {
      await repo.loadDemo(today())
      window.location.hash = '#/season'
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Er ging iets mis')
    }
  }

  async function removeDemo() {
    if (!confirm('Demodata verwijderen? Je eigen teams en wedstrijden blijven staan.'))
      return
    setError('')
    try {
      await repo.removeDemo()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Er ging iets mis')
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="page-title">Wedstrijden</h2>

      {empty && !viewerOnly && (
        <section className="card" aria-label="Demo">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="section-title">Eerst even kijken?</h3>
              <p className="mt-1 text-slate-600">
                Laad een voorbeeldseizoen met vier afgeronde wedstrijden, teams,
                spelers en ruim 600 acties met posities. Zo zie je direct het
                seizoensoverzicht, de statistieken, keepers, heatmap en export.
              </p>
            </div>
            <button className="btn btn-primary" onClick={() => void loadDemo()}>
              Demo laden
            </button>
          </div>
        </section>
      )}

      {!viewerOnly && (
      <section className="card" aria-label="Nieuwe wedstrijd">
        <h3 className="section-title mb-4">Nieuwe wedstrijd</h3>
        {needTeams ? (
          <p className="text-slate-600">
            Maak eerst minstens twee teams aan onder{' '}
            <a href="#/teams" className="font-semibold underline">
              Teams
            </a>
            .
          </p>
        ) : (
          <form onSubmit={create} className="space-y-4">
            {/* Rij 1: de teams. Rij 2: datum, tijdstip en plaats. */}
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="label">
                Thuisteam
                <select
                  className="field"
                  value={homeId}
                  onChange={(e) => setHomeId(e.target.value)}
                >
                  <option value="">Kies team…</option>
                  {teams?.map((t) => (
                    <option key={t.id} value={t.id} disabled={t.id === awayId}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="label">
                Uitteam
                <select
                  className="field"
                  value={awayId}
                  onChange={(e) => setAwayId(e.target.value)}
                >
                  <option value="">Kies team…</option>
                  {teams?.map((t) => (
                    <option key={t.id} value={t.id} disabled={t.id === homeId}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <label className="label">
                Datum
                <input
                  className="field"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </label>
              <label className="label">
                Tijdstip (optioneel)
                <input
                  className="field"
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                />
              </label>
              <label className="label">
                Plaats (optioneel)
                <input
                  className="field"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Bijv. Sporthal De Kuil"
                />
              </label>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <ColorPicker
                legend={`Kleur ${homeId ? teamName(homeId) : 'thuisteam'}`}
                value={homeColor}
                onChange={setHomeColor}
              />
              <ColorPicker
                legend={`Kleur ${awayId ? teamName(awayId) : 'uitteam'}`}
                value={awayColor}
                onChange={setAwayColor}
              />
            </div>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <fieldset>
                <legend className="label mb-1">HVM speelt</legend>
                <div className="segmented" role="radiogroup">
                  <label>
                    <input
                      type="radio"
                      name="ownSide"
                      checked={ownSide === 'home'}
                      onChange={() => setOwnSide('home')}
                    />
                    Thuis
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="ownSide"
                      checked={ownSide === 'away'}
                      onChange={() => setOwnSide('away')}
                    />
                    Uit
                  </label>
                </div>
              </fieldset>
              <button className="btn btn-primary" type="submit">
                Wedstrijd aanmaken
              </button>
            </div>
          </form>
        )}
        {error && (
          <p role="alert" className="alert mt-4">
            {error}
          </p>
        )}
      </section>
      )}

      <section className="card" aria-label="Alle wedstrijden">
        <h3 className="section-title mb-2">Alle wedstrijden</h3>
        {matches && matches.length === 0 ? (
          <p className="py-6 text-center text-slate-500">
            Nog geen wedstrijden.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Datum</th>
                  <th>Wedstrijd</th>
                  <th className="text-center">Stand</th>
                  <th>Indeling</th>
                  <th>Plaats</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {matches?.map((m) => {
                  const s = score(
                    (actions ?? []).filter((a) => a.matchId === m.id),
                    m.homeTeamId,
                    m.awayTeamId,
                  )
                  const label = `${teamName(m.homeTeamId)} – ${teamName(m.awayTeamId)}`
                  return (
                    <Fragment key={m.id}>
                    <tr>
                      <td className="whitespace-nowrap">
                        {formatDate(m.date)}
                        {m.time ? <span className="text-slate-500"> {m.time}</span> : null}
                      </td>
                      <td className="font-semibold">
                        {label}
                        <ScorerPicker match={m} />
                        {live.has(m.id) && (
                          <span className="chip ml-2" style={{ background: '#fee2e2', color: '#991b1b' }}>
                            ● Live
                          </span>
                        )}
                      </td>
                      <td className="text-center font-semibold tabular-nums">
                        {s.home} – {s.away}
                      </td>
                      <td>{m.format === 2 ? '2 helften' : '3 derden'}</td>
                      <td className="text-slate-600">{m.location ?? ''}</td>
                      <td className="whitespace-nowrap text-right">
                        <LiveLink
                          matchId={m.id}
                          className="btn btn-primary mr-2 inline-flex items-center no-underline"
                          label={`Open live ${label}`}
                        >
                          Live
                        </LiveLink>
                        <a
                          href={`#/stats/${m.id}`}
                          className="btn mr-2 inline-flex items-center no-underline"
                          aria-label={`Statistieken ${label}`}
                        >
                          Statistieken
                        </a>
                        <a
                          href={`#/sheet/${m.id}`}
                          className="btn mr-2 inline-flex items-center no-underline"
                          aria-label={`Rapport ${label}`}
                        >
                          Rapport
                        </a>
                        {!viewerOnly && !matchStarted(m, (actions ?? []).filter((x) => x.matchId === m.id).length) && (
                          <button
                            className="btn mr-2"
                            aria-expanded={prepId === m.id}
                            aria-label={`Voorbereiding ${label}`}
                            onClick={() => setPrepId(prepId === m.id ? null : m.id)}
                          >
                            Voorbereiding
                          </button>
                        )}
                        {!viewerOnly && (
                          <button
                            className="btn btn-danger"
                            aria-label={`Verwijder wedstrijd ${label}`}
                            onClick={() => void remove(m.id, label)}
                          >
                            ✕
                          </button>
                        )}
                      </td>
                    </tr>
                    {prepId === m.id && (
                      <tr>
                        <td colSpan={6} className="bg-slate-50">
                          <MatchPrep match={m} />
                        </td>
                      </tr>
                    )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Demo data next to the user's own data (the big card above only
          shows on a completely empty app). */}
      {!empty && !viewerOnly && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
          <span>
            {hasDemo
              ? 'De demo-wedstrijden staan in je lijst.'
              : 'Wil je eerst een voorbeeld zien?'}
          </span>
          {hasDemo ? (
            <button className="btn" onClick={() => void removeDemo()}>
              Demo verwijderen
            </button>
          ) : (
            <button className="btn" onClick={() => void loadDemo()}>
              Demo laden
            </button>
          )}
        </div>
      )}
    </div>
  )
}
