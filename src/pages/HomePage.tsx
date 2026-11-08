import { useRef, useState } from 'react'
import { useNow } from '../hooks/useNow'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/schema'
import { repo } from '../db/repo'
import { backupFileName, createBackup, parseBackup, restoreBackup } from '../db/backup'
import ScoreHero from '../components/ScoreHero'
import { downloadText } from '../lib/download'
import { liveMatchIds, topScorers } from '../lib/analysis'
import { seasonOf } from '../lib/season'
import { scoreByPeriod, score } from '../lib/stats'

function formatDate(iso: string) {
  const [y, m, d] = iso.split('-')
  return `${d}-${m}-${y}`
}

function today() {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export default function HomePage() {
  const teams = useLiveQuery(() => db.teams.toArray(), [])
  const players = useLiveQuery(() => db.players.toArray(), [])
  const matches = useLiveQuery(() => db.matches.toArray(), [])
  const actions = useLiveQuery(() => db.actions.toArray(), [])
  // Re-evaluated every minute so a match drops out of "live" by itself.
  const now = useNow(60_000)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  if (!teams || !players || !matches || !actions) return null

  const teamName = (id: string) => teams.find((t) => t.id === id)?.name ?? '?'
  const playerOf = (id: string) => players.find((p) => p.id === id)

  const empty = teams.length === 0 && matches.length === 0
  const sorted = [...matches].sort(
    (a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id),
  )
  const live = liveMatchIds(actions, now)
  const liveMatches = sorted.filter((m) => live.has(m.id))
  const featured = liveMatches[0] ?? sorted[0]
  const recent = sorted.slice(0, 5)

  const season = featured ? seasonOf(featured.date) : undefined
  const seasonMatchIds = new Set(
    matches.filter((m) => seasonOf(m.date) === season).map((m) => m.id),
  )
  const seasonActions = actions.filter((a) => seasonMatchIds.has(a.matchId))
  const scorers = topScorers(seasonActions, 5)
  const maxGoals = scorers[0]?.total ?? 1
  const goalsTotal = seasonActions.filter(
    (a) => a.type === 'goal' || a.type === 'penalty_goal',
  ).length

  const resultOf = (matchId: string, homeId: string, awayId: string) =>
    score(
      actions.filter((a) => a.matchId === matchId),
      homeId,
      awayId,
    )

  async function exportBackup() {
    const backup = await createBackup(db)
    downloadText(
      backupFileName(),
      JSON.stringify(backup, null, 1),
      'application/json;charset=utf-8',
    )
    setMessage({ ok: true, text: 'Back-up gedownload. Bewaar het bestand op een veilige plek.' })
  }

  async function importBackup(file: File) {
    setMessage(null)
    try {
      const backup = parseBackup(await file.text())
      const n = (c: number, one: string, many: string) => `${c} ${c === 1 ? one : many}`
      const summary = `${n(backup.teams.length, 'team', 'teams')}, ${n(backup.matches.length, 'wedstrijd', 'wedstrijden')}, ${n(backup.actions.length, 'actie', 'acties')}`
      if (
        !confirm(
          `Back-up terugzetten (${summary})?\n\nAlle huidige gegevens in deze browser worden vervangen.`,
        )
      )
        return
      await restoreBackup(db, backup)
      setMessage({ ok: true, text: `Back-up teruggezet: ${summary}.` })
    } catch (err) {
      setMessage({
        ok: false,
        text: err instanceof Error ? err.message : 'Terugzetten is mislukt.',
      })
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function loadDemo() {
    try {
      await repo.loadDemo(today())
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : 'Demo laden mislukt.' })
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="page-title">Overzicht</h2>
        <p className="page-sub">Handbalstatistieken, live en over het hele seizoen.</p>
      </div>

      {empty ? (
        <section className="card" aria-label="Aan de slag">
          <h3 className="text-xl font-bold">Welkom bij Pivotal</h3>
          <p className="mt-1 text-slate-600">
            In drie stappen naar je eerste statistieken.
          </p>
          <ol className="mt-4 grid gap-4 sm:grid-cols-3">
            {[
              ['1', 'Teams en spelers', 'Voeg je team, de tegenstander en de spelers toe.', '#/teams', 'Naar Teams'],
              ['2', 'Wedstrijd aanmaken', 'Kies thuis, uit, datum en 2 helften of 3 derden.', '#/matches', 'Naar Wedstrijden'],
              ['3', 'Live registreren', 'Toets rugnummer en actie, en klik de plek op het veld.', '#/matches', 'Starten'],
            ].map(([n, title, text, href, cta]) => (
              <li key={n} className="tile flex flex-col">
                <span className="rank rank-1">{n}</span>
                <strong className="mt-2">{title}</strong>
                <span className="tile-sub flex-1">{text}</span>
                <a href={href} className="btn mt-3 inline-flex items-center justify-center no-underline">
                  {cta}
                </a>
              </li>
            ))}
          </ol>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
            <span className="text-slate-600">Eerst even kijken? Laad een voorbeeldseizoen.</span>
            <button className="btn btn-primary" onClick={() => void loadDemo()}>
              Demo laden
            </button>
          </div>
        </section>
      ) : (
        <>
          {featured && (
            <a
              href={live.has(featured.id) ? `#/match/${featured.id}` : `#/stats/${featured.id}`}
              className="block no-underline"
              aria-label="Open uitgelichte wedstrijd"
            >
              <FeaturedHero
                homeName={teamName(featured.homeTeamId)}
                awayName={teamName(featured.awayTeamId)}
                date={featured.date}
                location={featured.location}
                live={live.has(featured.id)}
                actions={actions.filter((a) => a.matchId === featured.id)}
                homeId={featured.homeTeamId}
                awayId={featured.awayTeamId}
                twoHalves={featured.format === 2}
              />
            </a>
          )}

          <section className="grid gap-4 grid-cols-2 lg:grid-cols-4" aria-label="Samenvatting">
            <Tile label="Wedstrijden" value={matches.length} sub={season ? `seizoen ${season}: ${seasonMatchIds.size}` : ''} />
            <Tile label="Doelpunten" value={goalsTotal} sub={`dit seizoen`} />
            <Tile label="Teams" value={teams.length} sub={`${players.length} spelers`} />
            <Tile label="Acties" value={actions.length} sub="geregistreerd" />
          </section>

          {liveMatches.length > 0 && (
            <section className="card" aria-label="Live wedstrijden">
              <h3 className="section-title mb-2">Live nu</h3>
              <ul className="divide-y divide-slate-100">
                {liveMatches.map((m) => {
                  const s = resultOf(m.id, m.homeTeamId, m.awayTeamId)
                  return (
                    <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                      <span className="font-semibold">
                        {teamName(m.homeTeamId)} – {teamName(m.awayTeamId)}
                      </span>
                      <span className="flex items-center gap-3">
                        <span className="text-lg font-black tabular-nums">
                          {s.home} – {s.away}
                        </span>
                        <a href={`#/match/${m.id}`} className="btn btn-primary inline-flex items-center no-underline">
                          Open live
                        </a>
                      </span>
                    </li>
                  )
                })}
              </ul>
            </section>
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="card" aria-label="Topscorers">
              <h3 className="section-title mb-2">Topscorers {season ? `· ${season}` : ''}</h3>
              {scorers.length === 0 ? (
                <p className="py-6 text-center text-slate-500">Nog geen doelpunten.</p>
              ) : (
                scorers.map((s, i) => {
                  const p = playerOf(s.playerId)
                  return (
                    <a
                      key={s.playerId}
                      href={`#/player/${s.playerId}`}
                      className="bar-row no-underline"
                      style={{ color: 'inherit' }}
                    >
                      <span className={`rank ${i === 0 ? 'rank-1' : ''}`}>{i + 1}</span>
                      <span className="truncate font-semibold">
                        {p ? `#${p.number} ${p.name}` : '?'}
                        <span className="block text-xs font-normal text-slate-500">
                          {p ? teamName(p.teamId) : ''}
                        </span>
                      </span>
                      <span className="bar-track">
                        <span className="bar-fill block" style={{ width: `${(s.total / maxGoals) * 100}%` }} />
                      </span>
                      <span className="text-right font-bold tabular-nums">{s.total}</span>
                    </a>
                  )
                })
              )}
            </section>

            <section className="card" aria-label="Laatste wedstrijden">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="section-title">Laatste wedstrijden</h3>
                <a href="#/season" className="text-sm font-semibold underline">
                  Seizoen →
                </a>
              </div>
              <ul className="divide-y divide-slate-100">
                {recent.map((m) => {
                  const s = resultOf(m.id, m.homeTeamId, m.awayTeamId)
                  return (
                    <li key={m.id}>
                      <a
                        href={`#/stats/${m.id}`}
                        className="flex items-center justify-between gap-3 py-2.5 no-underline"
                        style={{ color: 'inherit' }}
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-semibold">
                            {teamName(m.homeTeamId)} – {teamName(m.awayTeamId)}
                          </span>
                          <span className="text-xs text-slate-500">
                            {formatDate(m.date)}
                            {m.location ? ` · ${m.location}` : ''}
                          </span>
                        </span>
                        <span className="flex items-center gap-2">
                          {live.has(m.id) && <span className="chip" style={{ background: '#fee2e2', color: '#991b1b' }}>Live</span>}
                          <span className="text-lg font-black tabular-nums">
                            {s.home} – {s.away}
                          </span>
                        </span>
                      </a>
                    </li>
                  )
                })}
              </ul>
            </section>
          </div>

          <section className="card" aria-label="Snel starten">
            <div className="flex flex-wrap items-center gap-3">
              <a href="#/matches" className="btn btn-primary inline-flex items-center no-underline">
                Nieuwe wedstrijd
              </a>
              <a href="#/teams" className="btn inline-flex items-center no-underline">
                Teams en spelers
              </a>
              <a href="#/season" className="btn inline-flex items-center no-underline">
                Seizoensoverzicht
              </a>
            </div>
          </section>
        </>
      )}

      <section className="card" aria-label="Gegevens">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="max-w-xl">
            <h3 className="section-title">Gegevens en back-up</h3>
            <p className="mt-1 text-sm text-slate-600">
              Alles staat alleen in deze browser. Maak regelmatig een back-up, of
              neem je gegevens mee naar een ander apparaat.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="btn" onClick={() => void exportBackup()} disabled={empty}>
              Back-up maken
            </button>
            <button className="btn" onClick={() => fileRef.current?.click()}>
              Back-up terugzetten
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              aria-label="Back-upbestand kiezen"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void importBackup(f)
              }}
            />
          </div>
        </div>
        {message && (
          <p
            role={message.ok ? 'status' : 'alert'}
            className={message.ok ? 'mt-3 text-sm font-semibold text-emerald-700' : 'alert mt-3'}
          >
            {message.text}
          </p>
        )}
      </section>
    </div>
  )
}

function Tile({ label, value, sub }: { label: string; value: number; sub: string }) {
  return (
    <div className="tile">
      <div className="tile-label">{label}</div>
      <div className="tile-value">{value}</div>
      <div className="tile-sub">{sub || ' '}</div>
    </div>
  )
}

function FeaturedHero({
  homeName,
  awayName,
  date,
  location,
  live,
  actions,
  homeId,
  awayId,
  twoHalves,
}: {
  homeName: string
  awayName: string
  date: string
  location?: string
  live: boolean
  actions: Parameters<typeof score>[0]
  homeId: string
  awayId: string
  twoHalves: boolean
}) {
  const s = score(actions, homeId, awayId)
  const half = twoHalves && actions.some((a) => a.period >= 2) ? scoreByPeriod(actions, homeId, awayId, 1)[0] : null
  return (
    <ScoreHero
      homeName={homeName}
      awayName={awayName}
      homeGoals={s.home}
      awayGoals={s.away}
      date={date}
      location={location}
      half={half}
      live={live}
    />
  )
}
