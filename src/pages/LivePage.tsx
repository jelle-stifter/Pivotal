import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/schema'
import { repo } from '../db/repo'
import { useMatchClock } from '../hooks/useMatchClock'
import ActionList, { type ActionPatch } from '../components/ActionList'
import Court from '../components/Court'
import { ACTION_GROUPS, ACTION_META, keyToAction } from '../lib/actions'
import {
  homeAttacksRight,
  teamAttacksRight,
  toNormalized,
  type Point,
} from '../lib/court'
import { resolveNumber } from '../lib/entry'
import { periodLabel } from '../lib/periods'
import { score } from '../lib/stats'
import { formatClock } from '../lib/time'
import {
  ACTION_TYPES,
  type Action,
  type ActionType,
  type Match,
  type Player,
  type Side,
  type Team,
} from '../types'

const BUFFER_TIMEOUT_MS = 1500

export default function LivePage({ matchId }: { matchId: string }) {
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
    <LiveScreen
      key={match.id}
      match={match}
      teams={teams}
      players={players}
      actions={actions}
    />
  )
}

function isTypingTarget(t: EventTarget | null) {
  if (!(t instanceof HTMLElement)) return false
  return (
    t.tagName === 'INPUT' ||
    t.tagName === 'TEXTAREA' ||
    t.tagName === 'SELECT' ||
    t.isContentEditable
  )
}

function LiveScreen({
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
  const teamNames = Object.fromEntries(teams.map((t) => [t.id, t.name]))

  const [side, setSide] = useState<Side>('home')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [buffer, setBuffer] = useState('')
  // Raw click on the court (screen orientation), attached to the next action.
  const [pendingPos, setPendingPos] = useState<Point | null>(null)
  const pendingRef = useRef<Point | null>(null)
  const [toast, setToast] = useState<{ text: string; error: boolean } | null>(
    null,
  )

  const clock = useMatchClock(match.clockMs, (ms) => {
    void repo.updateMatch(match.id, { clockMs: Math.round(ms) })
  })

  const bufferRef = useRef('')
  const bufferTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  )
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  )
  const keyHandler = useRef<(e: KeyboardEvent) => void>(() => undefined)
  const commitRef = useRef<() => Player | null>(() => null)

  const teamId = side === 'home' ? match.homeTeamId : match.awayTeamId
  const roster = players
    .filter((p) => p.teamId === teamId)
    .sort((a, b) => a.number - b.number)
  const selected = players.find((p) => p.id === selectedId) ?? null
  const sorted = [...actions].sort((a, b) => b.createdAt - a.createdAt)
  const result = score(actions, match.homeTeamId, match.awayTeamId)
  const lastPeriod = match.currentPeriod >= match.format

  const keepers = (tid: string) =>
    players.filter((p) => p.teamId === tid && p.isGoalkeeper)

  // If a team has exactly one keeper and none is set yet, set it (sequentially
  // to avoid read-modify-write races on the shared activeGoalkeeper object).
  const gkHome = match.activeGoalkeeper.home
  const gkAway = match.activeGoalkeeper.away
  useEffect(() => {
    void (async () => {
      const sides: [Side, string, string | undefined][] = [
        ['home', match.homeTeamId, gkHome],
        ['away', match.awayTeamId, gkAway],
      ]
      for (const [s, tid, current] of sides) {
        const ks = players.filter((p) => p.teamId === tid && p.isGoalkeeper)
        if (!current && ks.length === 1)
          await repo.setActiveGoalkeeper(match.id, s, ks[0].id)
      }
    })()
  }, [match.id, match.homeTeamId, match.awayTeamId, gkHome, gkAway, players])

  function flash(text: string, error = false) {
    setToast({ text, error })
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 3000)
  }

  function clearBuffer() {
    clearTimeout(bufferTimer.current)
    bufferRef.current = ''
    setBuffer('')
  }

  /** Resolve the typed digits into a player; returns it (or null if invalid). */
  function commitBuffer(): Player | null {
    const b = bufferRef.current
    if (!b) return null
    clearBuffer()
    const { player } = resolveNumber(b, roster)
    if (player) {
      setSelectedId(player.id)
      return player
    }
    flash(`Geen speler met nummer ${b}`, true)
    return null
  }
  commitRef.current = commitBuffer

  function selectSide(s: Side) {
    if (s === side) return
    clearBuffer()
    setSelectedId(null)
    setSide(s)
  }

  function setPending(p: Point | null) {
    pendingRef.current = p
    setPendingPos(p)
  }

  async function flipSides() {
    // A pending click was made in the old orientation: drop it.
    setPending(null)
    await repo.updateMatch(match.id, {
      homeAttacksRight: !homeAttacksRight(match),
    })
  }

  async function logAction(type: ActionType, explicit?: Player) {
    let player = explicit ?? selected
    // A save is credited to the goalkeeper on court when nobody is selected.
    if (!player && type === 'save') {
      const gkId = match.activeGoalkeeper[side]
      player = players.find((p) => p.id === gkId) ?? null
    }
    if (!player) return flash('Kies eerst een speler', true)
    // Take the pending position now (synchronously) so a quick second key
    // press cannot reuse it; convert with the acting player's team.
    const click = pendingRef.current
    const pos = click
      ? toNormalized(click, teamAttacksRight(match, player.teamId))
      : undefined
    setPending(null)
    try {
      await repo.logAction({
        matchId: match.id,
        teamId: player.teamId,
        playerId: player.id,
        type,
        clockMs: Math.round(clock.get()),
        x: pos?.x,
        y: pos?.y,
      })
      flash(
        `${ACTION_META[type].label} · #${player.number} ${player.name}${
          pos ? ' · positie' : ''
        }`,
      )
    } catch (e) {
      flash(e instanceof Error ? e.message : 'Opslaan mislukt', true)
    }
  }

  async function undo() {
    const undone = await repo.undoLastAction(match.id)
    flash(undone ? 'Laatste actie ongedaan gemaakt' : 'Niets om ongedaan te maken')
  }

  async function nextPeriod() {
    if (lastPeriod) return flash('Dit is de laatste periode', true)
    clock.pause()
    // Halftime of a 2-halves match: the teams swap ends. Thirds never auto-flip.
    const swap = match.format === 2
    if (swap) setPending(null)
    await repo.updateMatch(match.id, {
      currentPeriod: match.currentPeriod + 1,
      clockMs: Math.round(clock.get()),
      ...(swap ? { homeAttacksRight: !homeAttacksRight(match) } : {}),
    })
    flash(
      `Nu: ${periodLabel(match.format, match.currentPeriod + 1)}${
        swap ? ' · kanten gewisseld' : ''
      }`,
    )
  }

  keyHandler.current = (e: KeyboardEvent) => {
    if (e.repeat || isTypingTarget(e.target)) return

    if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'z') {
      e.preventDefault()
      void undo()
      return
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return

    if (/^\d$/.test(e.key)) {
      e.preventDefault()
      clearTimeout(bufferTimer.current)
      const next = bufferRef.current + e.key
      bufferRef.current = next
      setBuffer(next)
      const r = resolveNumber(next, roster)
      if (r.player && !r.pending) commitBuffer()
      else if (!r.player && !r.pending) {
        clearBuffer()
        flash(`Geen speler met nummer ${next}`, true)
      } else {
        bufferTimer.current = setTimeout(
          () => commitRef.current(),
          BUFFER_TIMEOUT_MS,
        )
      }
      return
    }

    switch (e.key) {
      case ' ':
        e.preventDefault()
        clock.toggle()
        return
      case 'Enter':
        if (bufferRef.current) {
          e.preventDefault()
          commitBuffer()
        }
        return
      case 'Escape':
        clearBuffer()
        setSelectedId(null)
        setPending(null)
        return
      case 'ArrowLeft':
        e.preventDefault()
        selectSide('home')
        return
      case 'ArrowRight':
        e.preventDefault()
        selectSide('away')
        return
      case 'Tab':
        // Only when nothing is focused, so normal keyboard navigation works.
        if (e.target === document.body) {
          e.preventDefault()
          selectSide(side === 'home' ? 'away' : 'home')
        }
        return
    }

    if (e.key.toLowerCase() === 'n') {
      e.preventDefault()
      void nextPeriod()
      return
    }

    const type = keyToAction(e.key, e.shiftKey)
    if (type) {
      e.preventDefault()
      const hadBuffer = bufferRef.current !== ''
      const typed = hadBuffer ? commitBuffer() : undefined
      if (hadBuffer && !typed) return
      void logAction(type, typed ?? undefined)
    }
  }

  useEffect(() => {
    const on = (e: KeyboardEvent) => keyHandler.current(e)
    window.addEventListener('keydown', on)
    return () => {
      window.removeEventListener('keydown', on)
      clearTimeout(bufferTimer.current)
      clearTimeout(toastTimer.current)
    }
  }, [])

  async function saveEdit(id: string, patch: ActionPatch) {
    try {
      await repo.updateAction(id, patch)
    } catch (e) {
      flash(e instanceof Error ? e.message : 'Opslaan mislukt', true)
    }
  }

  function deleteAction(id: string) {
    if (confirm('Deze actie verwijderen?')) void repo.deleteAction(id)
  }

  const missingKeeper = (['home', 'away'] as Side[])
    .map((s) => {
      const tid = s === 'home' ? match.homeTeamId : match.awayTeamId
      return keepers(tid).length > 0 && !match.activeGoalkeeper[s]
        ? teamName(tid)
        : null
    })
    .filter((n): n is string => n !== null)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h2 className="page-title">
          {teamName(match.homeTeamId)} – {teamName(match.awayTeamId)}
        </h2>
        <div className="flex gap-4 text-sm font-semibold">
          <a href={`#/stats/${match.id}`} className="underline">
            Statistieken
          </a>
          <a href="#/matches" className="underline">
            ← Wedstrijden
          </a>
        </div>
      </div>

      {/* Scoreboard + clock */}
      <section className="card" aria-label="Scorebord">
        <div className="grid items-center gap-4 text-center md:grid-cols-[1fr_auto_1fr]">
          <div className="text-lg font-semibold md:text-right">
            {teamName(match.homeTeamId)}
          </div>
          <div
            className="text-5xl font-black tabular-nums"
            aria-label={`Stand ${result.home} - ${result.away}`}
          >
            {result.home} – {result.away}
          </div>
          <div className="text-lg font-semibold md:text-left">
            {teamName(match.awayTeamId)}
          </div>
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3 border-t border-slate-200 pt-4">
          <div
            className="min-w-28 text-center text-3xl font-bold tabular-nums"
            aria-label="Wedstrijdklok"
          >
            {formatClock(clock.ms)}
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">
            {periodLabel(match.format, match.currentPeriod)}
          </span>
          <button
            className={`btn ${clock.running ? '' : 'btn-primary'}`}
            onClick={clock.toggle}
          >
            {clock.running ? 'Pauze' : 'Start'} <span className="kbd">Spatie</span>
          </button>
          <button
            className="btn"
            onClick={() => void nextPeriod()}
            disabled={lastPeriod}
          >
            Volgende periode <span className="kbd">N</span>
          </button>
          <button className="btn" onClick={() => void undo()}>
            Ongedaan <span className="kbd">Ctrl+Z</span>
          </button>
        </div>
      </section>

      {/* Entry */}
      <section className="card space-y-4" aria-label="Invoer">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="segmented" role="group" aria-label="Actief team">
            {(['home', 'away'] as Side[]).map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={side === s}
                className="seg-btn"
                onClick={() => selectSide(s)}
              >
                {teamName(s === 'home' ? match.homeTeamId : match.awayTeamId)}
              </button>
            ))}
          </div>
          <div className="text-sm text-slate-600" aria-live="polite">
            {buffer ? (
              <>
                Nummer: <strong className="tabular-nums">{buffer}</strong>…
              </>
            ) : selected ? (
              <>
                Geselecteerd:{' '}
                <strong>
                  #{selected.number} {selected.name}
                </strong>
              </>
            ) : (
              'Typ een rugnummer of klik een speler'
            )}
          </div>
        </div>

        <div className="roster">
          {roster.map((p) => {
            const isActiveGk = match.activeGoalkeeper[side] === p.id
            return (
              <button
                key={p.id}
                type="button"
                aria-pressed={p.id === selectedId}
                className="player-btn"
                onClick={() => {
                  clearBuffer()
                  setSelectedId(p.id)
                }}
              >
                <span className="player-nr">{p.number}</span>
                <span className="truncate">{p.name}</span>
                {p.isGoalkeeper && (
                  <span
                    className="gk-badge"
                    title={isActiveGk ? 'Keeper op het veld' : 'Keeper'}
                  >
                    {isActiveGk ? 'K●' : 'K'}
                  </span>
                )}
              </button>
            )
          })}
          {roster.length === 0 && (
            <p className="text-slate-500">
              Dit team heeft nog geen spelers. Voeg ze toe onder Teams.
            </p>
          )}
        </div>

        <div className="space-y-3">
          {ACTION_GROUPS.map((g) => (
            <div key={g.title}>
              <div className="section-title mb-1.5">{g.title}</div>
              <div className="action-pad">
                {g.types.map((t) => (
                  <button
                    key={t}
                    type="button"
                    className="action-btn"
                    onClick={() => void logAction(t)}
                  >
                    <span>{ACTION_META[t].label}</span>
                    <span className="kbd">{ACTION_META[t].key}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-2 border-t border-slate-200 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="section-title">Positie (optioneel)</div>
              <div className="text-sm text-slate-600">
                {teamName(match.homeTeamId)} valt aan{' '}
                {homeAttacksRight(match) ? '→' : '←'} ·{' '}
                {teamName(match.awayTeamId)} valt aan{' '}
                {homeAttacksRight(match) ? '←' : '→'}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {pendingPos && (
                <button className="btn" onClick={() => setPending(null)}>
                  Wis positie
                </button>
              )}
              <button className="btn" onClick={() => void flipSides()}>
                Wissel van kant
              </button>
            </div>
          </div>
          <div className="mx-auto max-w-3xl">
            <Court
              label="Speelveld: klik om de positie van de volgende actie te kiezen"
              pending={pendingPos}
              onPick={setPending}
            />
          </div>
          <p className="text-xs text-slate-500" aria-live="polite">
            {pendingPos
              ? 'Positie gezet: wordt gekoppeld aan de volgende actie (elk type).'
              : 'Klik op het veld om een positie te kiezen, en log dan de actie. Zonder klik wordt de actie zonder positie opgeslagen.'}
          </p>
        </div>

        <div
          role="status"
          aria-live="polite"
          className="min-h-6 text-sm font-semibold"
          style={{ color: toast?.error ? 'var(--danger)' : 'var(--brand-strong)' }}
        >
          {toast?.text ?? ''}
        </div>

        <p className="text-xs text-slate-500">
          Toetsen: typ rugnummer (Enter bevestigt) ·{' '}
          {ACTION_TYPES.map((t) => `${ACTION_META[t].key} ${ACTION_META[t].label.toLowerCase()}`).join(' · ')}{' '}
          · Tab of ←/→ team · Spatie klok · N volgende periode · Ctrl+Z
          ongedaan · Esc wis selectie en positie. Een save zonder gekozen
          speler gaat naar de keeper op het veld; een 7m-doelpunt, -stop of
          -mis wordt aan de keeper van de tegenstander toegekend.
        </p>
      </section>

      {/* Goalkeepers */}
      <section className="card" aria-label="Keepers op het veld">
        <h3 className="section-title mb-3">Keeper op het veld</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          {(['home', 'away'] as Side[]).map((s) => {
            const tid = s === 'home' ? match.homeTeamId : match.awayTeamId
            const ks = keepers(tid)
            return (
              <label key={s} className="label">
                {teamName(tid)}
                <select
                  className="field"
                  value={match.activeGoalkeeper[s] ?? ''}
                  onChange={(e) =>
                    void repo.setActiveGoalkeeper(
                      match.id,
                      s,
                      e.target.value || undefined,
                    )
                  }
                  disabled={ks.length === 0}
                >
                  <option value="">
                    {ks.length === 0 ? 'Geen keepers in team' : 'Geen keeper'}
                  </option>
                  {ks.map((k) => (
                    <option key={k.id} value={k.id}>
                      #{k.number} {k.name}
                    </option>
                  ))}
                </select>
              </label>
            )
          })}
        </div>
        {missingKeeper.length > 0 && (
          <p className="mt-3 text-sm text-amber-700">
            Geen keeper ingesteld voor {missingKeeper.join(' en ')}: goals
            tegen worden dan niet aan een keeper toegekend.
          </p>
        )}
      </section>

      {/* Action list */}
      <section className="card" aria-label="Acties">
        <h3 className="section-title mb-2">Acties ({sorted.length})</h3>
        <ActionList
          actions={sorted}
          players={players}
          teamNames={teamNames}
          format={match.format}
          onSave={saveEdit}
          onDelete={deleteAction}
        />
      </section>
    </div>
  )
}
