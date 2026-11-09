import { useEffect, useState, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/schema'
import { repo } from '../db/repo'
import { useMatchClock } from '../hooks/useMatchClock'
import { useMatchAccess, useMemberships } from '../hooks/useAccess'
import { useDisplayName } from '../hooks/useDisplayName'
import { useWakeLock } from '../hooks/useWakeLock'
import { liveLockedByOther } from '../lib/access'
import { refreshMatch } from '../lib/sync'
import {
  activePenalties,
  capGameMs,
  countdownMs,
  halfEnded,
  periodChange,
  periodStartMs,
  HALF_MS,
} from '../lib/clock'
import type { FlowSpec } from '../lib/flows'
import { topScorerRows } from '../lib/live'
import {
  OWN_COLOR,
  opponentColors,
  opponentTeamId,
  ownSide,
  ownTeamId,
  shortName,
} from '../lib/ownTeam'
import { periodLabel } from '../lib/periods'
import { score } from '../lib/stats'
import { formatClock } from '../lib/time'
import FlowSheet from '../components/live/FlowSheet'
import MatchPrep from '../components/MatchPrep'
import { PenaltyList, ScorersPanel } from '../components/live/LivePanels'
import StatsPage from './StatsPage'
import type { Action, ActionType, Match, Player, Team } from '../types'

export default function LivePage({ matchId }: { matchId: string }) {
  const matches = useLiveQuery(
    () => db.matches.where('id').equals(matchId).toArray(),
    [matchId],
  )
  const teams = useLiveQuery(() => db.teams.toArray(), [])
  const match = matches?.[0]
  const access = useMatchAccess(match)
  const { uid } = useMemberships()
  // Before the live screen opens, ask the server who is scoring (the local copy can be old).
  const [checked, setChecked] = useState(!uid)
  useEffect(() => {
    if (!uid) return
    let alive = true
    const done = () => alive && setChecked(true)
    const timer = setTimeout(done, 3000)
    refreshMatch(matchId)
      .catch(() => undefined)
      .finally(() => {
        clearTimeout(timer)
        done()
      })
    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [matchId, uid])
  const { name: myName } = useDisplayName()
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

  // A normal player only sees statistics, never the live screen.
  if (access === 'view') return <StatsPage matchId={match.id} />

  if (!checked) return <p className="py-6 text-center text-slate-500">Wedstrijd controleren…</p>

  // Someone else is scoring this match right now.
  const lockedBy = liveLockedByOther(match, uid, Date.now())
  if (lockedBy && uid) {
    return (
      <div className="card space-y-3">
        <h2 className="page-title">{lockedBy} scoort al</h2>
        <p className="text-slate-600">
          Twee mensen tegelijk scoren geeft dubbele acties. Neem alleen over als de ander echt
          stopt.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            className="btn btn-primary"
            onClick={() =>
              void repo.updateMatch(match.id, { liveBy: uid, liveByName: myName, liveAt: Date.now() })
            }
          >
            Overnemen
          </button>
          <a href={`#/stats/${match.id}`} className="btn inline-flex items-center no-underline">
            Statistieken bekijken
          </a>
          <a href="#/matches" className="btn inline-flex items-center no-underline">
            ← Wedstrijden
          </a>
        </div>
      </div>
    )
  }

  return (
    <LiveScreen
      key={match.id}
      uid={uid}
      myName={myName}
      match={match}
      teams={teams}
      players={players}
      actions={actions}
    />
  )
}

/** A big touch button on the live screen (at least 44px, mostly much bigger). */
function PadButton({
  children,
  color,
  textColor = '#fff',
  onClick,
  disabled,
  className = '',
}: {
  children: ReactNode
  color: string
  textColor?: string
  onClick: () => void
  disabled?: boolean
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{ background: color, color: textColor }}
      className={`min-h-[56px] rounded-xl px-2 text-base font-bold leading-tight shadow-sm transition active:scale-[0.97] disabled:opacity-40 sm:text-lg ${className}`}
    >
      {children}
    </button>
  )
}

function LiveScreen({
  uid,
  myName,
  match,
  teams,
  players,
  actions,
}: {
  uid: string | null
  myName: string
  match: Match
  teams: Team[]
  players: Player[]
  actions: Action[]
}) {
  const [flow, setFlow] = useState<FlowSpec | null>(null)
  const [showPrep, setShowPrep] = useState(false)
  const [toast, setToast] = useState<{ text: string; error: boolean } | null>(null)

  const clock = useMatchClock(match.clockMs, match.clockStartedAt, (patch) => {
    void repo.updateMatch(match.id, patch)
  })

  // Keep the screen on while scoring.
  useWakeLock(!match.finishedAt)

  // Tell others that I am scoring (advisory lock, refreshed while this screen is open).
  useEffect(() => {
    if (!uid) return
    const claim = () =>
      void repo.updateMatch(match.id, { liveBy: uid, liveByName: myName, liveAt: Date.now() })
    claim()
    const id = setInterval(claim, 30_000)
    return () => clearInterval(id)
  }, [uid, myName, match.id])

  // A toast disappears by itself.
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(t)
  }, [toast])

  const period = match.currentPeriod
  const periods = match.format
  const finished = Boolean(match.finishedAt)
  const gameMs = capGameMs(clock.ms, period)
  const ended = halfEnded(clock.ms, period)

  // At 0:00 the clock stops by itself; the screen then shows 30:00 again.
  useEffect(() => {
    if (clock.running && ended)
      void repo.updateMatch(match.id, {
        clockMs: periodStartMs(period) + HALF_MS,
        clockStartedAt: undefined,
      })
  }, [clock.running, ended, match.id, period])

  const ownId = ownTeamId(match)
  const oppId = opponentTeamId(match)
  const teamOf = (id: string) => teams.find((t) => t.id === id)
  const own = ownSide(match) // the side of our own team (HVM)
  const colors = { own: OWN_COLOR, opp: opponentColors(match.opponentColor) }
  const homeColor = (own === 'home' ? colors.own : colors.opp).main
  const awayColor = (own === 'away' ? colors.own : colors.opp).main
  const result = score(actions, match.homeTeamId, match.awayTeamId)

  // If a team has exactly one keeper and none is set yet, set it (sequentially
  // to avoid read-modify-write races on the shared activeGoalkeeper object).
  const gkHome = match.activeGoalkeeper.home
  const gkAway = match.activeGoalkeeper.away
  useEffect(() => {
    void (async () => {
      const sides = [
        ['home', match.homeTeamId, gkHome],
        ['away', match.awayTeamId, gkAway],
      ] as const
      for (const [s, tid, current] of sides) {
        const ks = players.filter((p) => p.teamId === tid && p.isGoalkeeper)
        if (!current && ks.length === 1) await repo.setActiveGoalkeeper(match.id, s, ks[0].id)
      }
    })()
  }, [match.id, match.homeTeamId, match.awayTeamId, gkHome, gkAway, players])

  const flash = (text: string, error = false) => setToast({ text, error })

  function toggleClock() {
    if (finished) return
    if (ended) {
      flash(period < periods ? 'Ga eerst naar de volgende helft (+)' : 'De wedstrijd is afgelopen', true)
      return
    }
    clock.toggle()
  }

  async function changePeriod(delta: 1 | -1) {
    if (finished) return
    const change = periodChange(period, delta, periods)
    if (!change) return
    await repo.updateMatch(match.id, {
      currentPeriod: change.period,
      clockMs: change.clockMs,
      clockStartedAt: undefined,
    })
  }

  async function undo() {
    const undone = await repo.undoLastAction(match.id)
    flash(undone ? 'Laatste actie ongedaan gemaakt' : 'Niets om ongedaan te maken', !undone)
  }

  async function finishMatch() {
    if (
      !confirm(
        'Wedstrijd beëindigen? De klok stopt en de wedstrijd is niet meer live. Je kunt hem later heropenen.',
      )
    )
      return
    await repo.updateMatch(match.id, {
      clockMs: Math.round(clock.get()),
      clockStartedAt: undefined,
      finishedAt: Date.now(),
    })
    flash('Wedstrijd beëindigd')
  }

  async function reopenMatch() {
    await repo.updateMatch(match.id, { finishedAt: undefined })
    flash('Wedstrijd heropend')
  }

  const start = (spec: FlowSpec) => {
    if (finished) return flash('Wedstrijd is beëindigd. Heropen hem om acties te loggen.', true)
    setFlow(spec)
  }
  const single = (side: 'own' | 'opp', type: ActionType): FlowSpec => ({ kind: 'single', side, type })

  /** The button set of one side: extended for our own team, simple for the opponent. */
  function sideButtons(isOwn: boolean, color: string) {
    const gap = 'grid gap-2'
    if (isOwn)
      return (
        <div className="flex flex-1 flex-col gap-2">
          <div className={`${gap} flex-1 grid-cols-2`}>
            <PadButton color={color} onClick={() => start({ kind: 'goal', side: 'own' })}>
              Doelpunt
            </PadButton>
            <PadButton color={color} onClick={() => start({ kind: 'penalty', side: 'own' })}>
              7 meter
            </PadButton>
            <PadButton color={color} onClick={() => start(single('own', 'shot'))}>
              Miss
            </PadButton>
            <PadButton color={color} onClick={() => start(single('own', 'off_target'))}>
              Niet op doel
            </PadButton>
          </div>
          <div className="rounded-xl bg-black/20 p-2">
            <div className="mb-1 px-1 text-xs font-bold uppercase tracking-wide text-white/60">
              Fouten last
            </div>
            <div className="grid grid-cols-3 gap-2">
              <PadButton color="#4b5563" className="!text-xs sm:!text-sm" onClick={() => start(single('own', 'bad_pass'))}>
                Pass fout
              </PadButton>
              <PadButton color="#4b5563" className="!text-xs sm:!text-sm" onClick={() => start(single('own', 'technical_foul'))}>
                Technische fout
              </PadButton>
              <PadButton color="#4b5563" className="!text-xs sm:!text-sm" onClick={() => start(single('own', 'interception'))}>
                Onderschepping
              </PadButton>
            </div>
          </div>
          <PadButton color={color} className="min-h-[64px]" onClick={() => start(single('own', 'block'))}>
            Block
          </PadButton>
        </div>
      )
    return (
      <div className="grid flex-1 grid-cols-2 gap-2">
        <PadButton color={color} onClick={() => start({ kind: 'goal', side: 'opp' })}>
          Doelpunt
        </PadButton>
        <PadButton color={color} onClick={() => start({ kind: 'save' })}>
          Stop
        </PadButton>
        <PadButton color={color} onClick={() => start(single('opp', 'off_target'))}>
          Niet op doel
        </PadButton>
        <PadButton color={color} onClick={() => start({ kind: 'penalty', side: 'opp' })}>
          7 meter
        </PadButton>
      </div>
    )
  }

  const penalties = activePenalties(actions, gameMs)
  const sideHeader = (side: 'home' | 'away') => {
    const t = teamOf(side === 'home' ? match.homeTeamId : match.awayTeamId)
    const color = side === 'home' ? homeColor : awayColor
    return (
      <div className="flex items-center gap-2 text-sm font-bold">
        <span aria-hidden className="inline-block h-3 w-3 rounded-full" style={{ background: color }} />
        <span className="truncate">
          {t?.name ?? '?'} <span className="font-normal text-white/60">· {side === 'home' ? 'Thuis' : 'Uit'}</span>
        </span>
      </div>
    )
  }

  const homeIsOwn = own === 'home'
  const buttonsLocked = finished

  return (
    <div
      className="fixed inset-x-0 bottom-0 top-14 z-10 overflow-y-auto text-white"
      style={{ background: '#2a2c30', fontFamily: 'system-ui, sans-serif' }}
    >
      <div className="mx-auto grid min-h-full max-w-[1440px] gap-3 p-3 lg:h-full lg:grid-cols-[1fr_17rem_1fr_16rem] lg:grid-rows-[1fr_auto]">
        {/* Left: clock and the buttons of the home side */}
        <div className="flex min-h-0 flex-col gap-3">
          <div className="flex items-stretch gap-3">
            <button
              type="button"
              onClick={toggleClock}
              disabled={finished}
              aria-label={clock.running ? 'Stop de klok' : 'Start de klok'}
              style={{ background: clock.running ? '#dc2626' : '#16a34a' }}
              className="min-h-[88px] min-w-[7.5rem] rounded-2xl px-4 text-2xl font-extrabold shadow-md transition active:scale-[0.97] disabled:opacity-40"
            >
              {clock.running ? 'Stop' : 'Start'}
            </button>
            <div
              className="flex flex-1 items-center justify-center rounded-2xl bg-black/30 px-3 text-5xl font-bold tabular-nums sm:text-6xl"
              aria-label="Wedstrijdklok"
              role="timer"
            >
              {formatClock(countdownMs(clock.ms, period))}
            </div>
          </div>
          {sideHeader('home')}
          <div className={`flex min-h-0 flex-1 flex-col ${buttonsLocked ? 'pointer-events-none opacity-60' : ''}`}>
            {sideButtons(homeIsOwn, homeColor)}
          </div>
        </div>

        {/* Middle: score, half, running suspensions */}
        <div className="flex min-h-0 flex-col gap-3">
          <section className="rounded-2xl bg-black/30 p-3 text-center" aria-label="Stand">
            <h2 className="text-xs font-bold uppercase tracking-widest text-white/60">Stand</h2>
            <div className="mt-1 flex items-center justify-center gap-2 text-4xl font-extrabold tabular-nums">
              <span style={{ color: homeColor }}>{shortName(teamOf(match.homeTeamId))}</span>
              <span>{result.home}</span>
              <span className="text-white/40">|</span>
              <span>{result.away}</span>
              <span style={{ color: awayColor }}>{shortName(teamOf(match.awayTeamId))}</span>
            </div>
            <div className="mt-1 flex justify-between text-xs text-white/60">
              <span>Thuis</span>
              <span>Uit</span>
            </div>
            {finished && (
              <div className="mt-2 flex items-center justify-center gap-2">
                <span className="rounded-full bg-white/15 px-3 py-1 text-sm font-semibold">Beëindigd</span>
                <button
                  type="button"
                  onClick={() => void reopenMatch()}
                  className="min-h-11 rounded-lg border border-white/30 px-3 text-sm font-semibold hover:bg-white/10"
                >
                  Heropenen
                </button>
              </div>
            )}
          </section>

          <div className="flex items-center justify-between rounded-xl bg-black/25 p-1" aria-label="Helft">
            <button
              type="button"
              aria-label="Vorige helft"
              onClick={() => void changePeriod(-1)}
              disabled={finished || period <= 1}
              className="min-h-11 min-w-11 rounded-lg px-3 text-2xl font-bold hover:bg-white/10 disabled:opacity-30"
            >
              −
            </button>
            <span className="text-sm font-semibold">{periodLabel(periods, period)}</span>
            <button
              type="button"
              aria-label="Volgende helft"
              onClick={() => void changePeriod(1)}
              disabled={finished || period >= periods}
              className="min-h-11 min-w-11 rounded-lg px-3 text-2xl font-bold hover:bg-white/10 disabled:opacity-30"
            >
              +
            </button>
          </div>

          <PenaltyList
            penalties={penalties}
            players={players}
            teams={teams}
            colors={{ own: colors.own.main, opp: colors.opp.main }}
            ownTeamId={ownId}
          />
          <button
            type="button"
            onClick={() => setShowPrep(true)}
            className="min-h-11 rounded-xl border border-white/25 px-3 text-sm font-semibold hover:bg-white/10"
          >
            Voorbereiding
          </button>
        </div>

        {/* Right: the away side, with undo next to its team name */}
        <div className="flex min-h-0 flex-col gap-3">
          <div className="flex min-h-[88px] items-center justify-between gap-2 rounded-2xl bg-black/25 px-3">
            {sideHeader('away')}
            <button
              type="button"
              onClick={() => void undo()}
              className="min-h-11 shrink-0 rounded-lg border border-white/30 px-3 text-sm font-bold hover:bg-white/10"
            >
              Ongedaan maken
            </button>
          </div>
          <div className="h-5" aria-hidden />
          <div className={`flex min-h-0 flex-1 flex-col ${buttonsLocked ? 'pointer-events-none opacity-60' : ''}`}>
            {sideButtons(!homeIsOwn, awayColor)}
          </div>
        </div>

        {/* Far right: top scorers */}
        <div className="flex min-h-0 flex-col gap-3">
          <ScorersPanel
            opponent={topScorerRows(actions, oppId)}
            own={topScorerRows(actions, ownId)}
            players={players}
            colors={{ own: colors.own.accent, opp: colors.opp.accent }}
          />
        </div>

        {/* Bottom: cards and 2 minutes, and ending the match */}
        <div
          className={`grid grid-cols-4 gap-2 lg:col-span-3 ${buttonsLocked ? 'pointer-events-none opacity-60' : ''}`}
        >
          <PadButton color="#eab308" textColor="#111" onClick={() => start({ kind: 'card', type: 'yellow_card' })}>
            Geel
          </PadButton>
          <PadButton color="#52525b" onClick={() => start({ kind: 'card', type: 'suspension' })}>
            2 Min
          </PadButton>
          <PadButton color="#dc2626" onClick={() => start({ kind: 'card', type: 'red_card' })}>
            Rood
          </PadButton>
          <PadButton color="#2563eb" onClick={() => start({ kind: 'card', type: 'blue_card' })}>
            Blauw
          </PadButton>
        </div>
        <div className="flex">
          <button
            type="button"
            onClick={() => void finishMatch()}
            disabled={finished}
            className="min-h-[56px] w-full rounded-xl border border-red-400/60 px-3 font-bold text-red-200 hover:bg-red-500/20 disabled:opacity-30"
          >
            Wedstrijd beëindigen
          </button>
        </div>
      </div>

      <div
        role="status"
        aria-live="polite"
        className={`pointer-events-none fixed bottom-20 left-1/2 z-40 -translate-x-1/2 rounded-full px-4 py-2 text-sm font-semibold shadow-lg ${
          toast ? '' : 'hidden'
        }`}
        style={{ background: toast?.error ? '#7f1d1d' : '#0f766e', color: '#fff' }}
      >
        {toast?.text}
      </div>

      {showPrep && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3"
          role="dialog"
          aria-modal="true"
          aria-label="Voorbereiding"
        >
          <div className="max-h-full w-full max-w-4xl overflow-y-auto rounded-2xl bg-white p-4 text-slate-900 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="page-title">Voorbereiding</h2>
              <button className="btn btn-primary" onClick={() => setShowPrep(false)}>
                Klaar
              </button>
            </div>
            <MatchPrep match={match} />
          </div>
        </div>
      )}

      {flow && (
        <FlowSheet
          spec={flow}
          match={match}
          teams={teams}
          players={players}
          getClockMs={() => capGameMs(clock.get(), period)}
          onClose={(message) => {
            setFlow(null)
            if (message) flash(message)
          }}
        />
      )}
    </div>
  )
}
