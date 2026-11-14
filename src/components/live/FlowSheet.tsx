import { useState } from 'react'
import { repo } from '../../db/repo'
import { ACTION_META } from '../../lib/actions'
import {
  buildActions,
  lastAnsweredKey,
  nextStep,
  type Answers,
  type FlowSpec,
  type Step,
} from '../../lib/flows'
import { opponentTeamId, ownSide, ownTeamId, shortName } from '../../lib/ownTeam'
import { POSITIONS } from '../../lib/positions'
import { validateOpponentInput } from '../../lib/prep'
import type { Match, Player, Team } from '../../types'

interface Item {
  value: string
  number?: number
  name: string
  sub?: string
}

function flowTitle(spec: FlowSpec): string {
  switch (spec.kind) {
    case 'goal':
      return 'Doelpunt'
    case 'penalty':
      return '7 meter'
    case 'save':
      return 'Stop'
    case 'single':
    case 'card':
      return ACTION_META[spec.type].label
  }
}

/** The grid of players (or staff) with a search box for number or name. */
function ItemGrid({
  items,
  quick = [],
  onPick,
  onAddNumber,
  onSkip,
  skipLabel,
}: {
  items: Item[]
  /** Values that are shown first, larger (the coach's top 3 penalty takers). */
  quick?: string[]
  onPick: (value: string) => void
  /** Opponents: a number that is not in the list can be added right away. */
  onAddNumber?: (n: number) => void
  onSkip?: () => void
  skipLabel?: string
}) {
  const [q, setQ] = useState('')
  const text = q.trim().toLowerCase()
  const isNumber = /^\d{1,3}$/.test(text)
  const shown = items.filter((i) =>
    text === ''
      ? true
      : isNumber
        ? String(i.number ?? '').startsWith(text)
        : i.name.toLowerCase().includes(text) || (i.sub ?? '').toLowerCase().includes(text),
  )
  const canAdd =
    onAddNumber !== undefined && isNumber && !items.some((i) => i.number === Number(text))
  const first = shown.filter((i) => quick.includes(i.value))
  const rest = shown.filter((i) => !quick.includes(i.value))

  const btn = (i: Item, big = false) => (
    <button
      key={i.value}
      type="button"
      onClick={() => onPick(i.value)}
      className={`flex items-center gap-3 rounded-xl border border-white/15 bg-white/10 px-4 text-left font-semibold hover:bg-white/20 active:bg-white/30 ${
        big ? 'min-h-[96px] text-2xl' : 'min-h-[80px] text-xl'
      }`}
    >
      {i.number !== undefined && (
        <span className={`min-w-12 font-extrabold tabular-nums ${big ? 'text-5xl' : 'text-4xl'}`}>
          {i.number}
        </span>
      )}
      <span className="min-w-0">
        <span className="block truncate">{i.name}</span>
        {i.sub && <span className="block truncate text-sm font-normal text-white/60">{i.sub}</span>}
      </span>
    </button>
  )

  return (
    <div className="space-y-3">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== 'Enter') return
          if (shown.length === 1) onPick(shown[0].value)
          else if (shown.length === 0 && canAdd) onAddNumber?.(Number(text))
        }}
        inputMode="search"
        placeholder="Typ een nummer of naam"
        aria-label="Zoek op nummer of naam"
        className="w-full rounded-lg border border-white/20 bg-black/30 px-3 text-white placeholder:text-white/40"
      />
      {first.length > 0 && (
        <div>
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-white/60">
            Snelkeuze
          </div>
          <div className="grid grid-cols-3 gap-2">{first.map((i) => btn(i, true))}</div>
        </div>
      )}
      <div className="grid max-h-[52vh] grid-cols-2 gap-3 overflow-y-auto md:grid-cols-3">
        {rest.map((i) => btn(i))}
        {canAdd && (
          <button
            type="button"
            onClick={() => onAddNumber?.(Number(text))}
            className="min-h-[80px] rounded-xl border border-dashed border-white/40 px-3 text-xl font-semibold hover:bg-white/10"
          >
            + Nummer {text} toevoegen
          </button>
        )}
        {shown.length === 0 && !canAdd && (
          <p className="col-span-full py-3 text-white/60">Niemand gevonden.</p>
        )}
      </div>
      {onSkip && (
        <button
          type="button"
          onClick={onSkip}
          className="min-h-[56px] w-full rounded-lg border border-white/25 px-4 font-semibold hover:bg-white/10"
        >
          {skipLabel ?? 'Overslaan'}
        </button>
      )}
    </div>
  )
}

/**
 * One flow on the live screen: a few choices after each other, then the
 * actions are saved together (one undo removes them all).
 */
export default function FlowSheet({
  spec,
  match,
  teams,
  players,
  getClockMs,
  onClose,
}: {
  spec: FlowSpec
  match: Match
  teams: Team[]
  players: Player[]
  /** Game time to stamp on the actions. */
  getClockMs: () => number
  onClose: (message?: string) => void
}) {
  const [answers, setAnswers] = useState<Answers>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const ownId = ownTeamId(match)
  const oppId = opponentTeamId(match)
  const teamOf = (id: string) => teams.find((t) => t.id === id)
  const step: Step | null = nextStep(spec, answers)

  const playing = (id: string) =>
    players
      .filter((p) => p.teamId === id && !(id === ownId && match.absent?.[p.id]))
      .sort((a, b) => a.number - b.number)
  const toItems = (list: Player[]): Item[] =>
    list.map((p) => ({
      value: p.id,
      number: p.number,
      name: p.name,
      sub: p.isGoalkeeper ? 'Keeper' : undefined,
    }))

  async function commit(a: Answers) {
    setBusy(true)
    try {
      const drafts = buildActions(spec, a, {
        matchId: match.id,
        ownTeamId: ownId,
        oppTeamId: oppId,
        ownGoalkeeperId: match.activeGoalkeeper[ownSide(match)],
        groupId: crypto.randomUUID(),
      })
      const clockMs = Math.round(getClockMs())
      for (const d of drafts) await repo.logAction({ ...d, clockMs })
      // The keeper you pick is the keeper on court from now on.
      if (a.keeper) await repo.setActiveGoalkeeper(match.id, ownSide(match), a.keeper)
      const who = players.find((p) => p.id === drafts[0]?.playerId)
      const staff = teamOf(drafts[0]?.teamId)?.staff?.find((s) => s.id === drafts[0]?.staffId)
      onClose(
        `${flowTitle(spec)}${who ? ` · #${who.number} ${who.name}` : staff ? ` · ${staff.name}` : ''}`,
      )
    } catch (e) {
      setBusy(false)
      setError(e instanceof Error ? e.message : 'Opslaan mislukt')
    }
  }

  function answer(value: string) {
    if (!step || busy) return
    const next = { ...answers, [step.key]: value }
    setAnswers(next)
    if (nextStep(spec, next) === null) void commit(next)
  }

  function back() {
    const key = lastAnsweredKey(spec, answers)
    if (!key) return onClose()
    const next = { ...answers }
    delete next[key]
    setAnswers(next)
  }

  async function addOpponent(n: number) {
    const check = validateOpponentInput(
      players.filter((p) => p.teamId === oppId).map((p) => p.number),
      String(n),
    )
    if (!check.ok) return setError(check.error)
    setError('')
    try {
      const p = await repo.addPlayer({
        teamId: oppId,
        name: `Speler ${n}`,
        number: n,
        position: '',
        isGoalkeeper: false,
      })
      answer(p.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Toevoegen mislukt')
    }
  }

  function body(s: Step) {
    switch (s.kind) {
      case 'ownPlayer': {
        const ex = s.excludeKey ? answers[s.excludeKey] : undefined
        const list = playing(ownId).filter((p) => p.id !== ex)
        const quick = s.quick ? (match.penaltyTakers ?? []).filter((id) => list.some((p) => p.id === id)) : []
        return (
          <ItemGrid
            items={toItems(list)}
            quick={quick}
            onPick={answer}
            onSkip={s.optional ? () => answer('') : undefined}
            skipLabel="Geen assist"
          />
        )
      }
      case 'ownKeeper': {
        const all = playing(ownId)
        const keepers = all.filter((p) => p.isGoalkeeper)
        return <ItemGrid items={toItems(keepers.length > 0 ? keepers : all)} onPick={answer} />
      }
      case 'oppPlayer':
        return (
          <ItemGrid
            items={toItems(playing(oppId))}
            onPick={answer}
            onAddNumber={(n) => void addOpponent(n)}
          />
        )
      case 'position':
        return (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {POSITIONS.map((p) => (
              <button
                key={p.code}
                type="button"
                onClick={() => answer(p.code)}
                className="min-h-[72px] rounded-lg border border-white/15 bg-white/10 px-2 font-semibold hover:bg-white/20 active:bg-white/30"
              >
                <span className="block text-xl font-extrabold">{p.code}</span>
                <span className="block text-xs font-normal text-white/70">{p.label}</span>
              </button>
            ))}
          </div>
        )
      case 'choice':
        return (
          <div className="grid gap-2 sm:grid-cols-3">
            {s.options?.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => answer(o.value)}
                className="min-h-[88px] rounded-lg border border-white/15 bg-white/10 px-3 text-lg font-bold hover:bg-white/20 active:bg-white/30"
              >
                {o.label}
              </button>
            ))}
          </div>
        )
      case 'team':
        return (
          <div className="grid gap-2 sm:grid-cols-2">
            {(['own', 'opp'] as const).map((side) => (
              <button
                key={side}
                type="button"
                onClick={() => answer(side)}
                className="min-h-[88px] rounded-lg border border-white/15 bg-white/10 px-3 text-lg font-bold hover:bg-white/20 active:bg-white/30"
              >
                {shortName(teamOf(side === 'own' ? ownId : oppId))}
                <span className="block text-sm font-normal text-white/70">
                  {teamOf(side === 'own' ? ownId : oppId)?.name}
                </span>
              </button>
            ))}
          </div>
        )
      case 'person': {
        const id = s.team === 'opp' ? oppId : ownId
        const staff: Item[] = (teamOf(id)?.staff ?? []).map((m) => ({
          value: `s:${m.id}`,
          name: m.name,
          sub: m.role,
        }))
        const people: Item[] = playing(id).map((p) => ({
          value: `p:${p.id}`,
          number: p.number,
          name: p.name,
        }))
        return (
          <ItemGrid
            items={[...people, ...staff]}
            onPick={answer}
            onAddNumber={
              s.team === 'opp'
                ? (n) =>
                    void repo
                      .addPlayer({
                        teamId: oppId,
                        name: `Speler ${n}`,
                        number: n,
                        position: '',
                        isGoalkeeper: false,
                      })
                      .then((p) => answer(`p:${p.id}`))
                      .catch((e: unknown) =>
                        setError(e instanceof Error ? e.message : 'Toevoegen mislukt'),
                      )
                : undefined
            }
          />
        )
      }
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3"
      role="dialog"
      aria-modal="true"
      aria-label={flowTitle(spec)}
    >
      <div className="max-h-full w-full max-w-4xl overflow-y-auto rounded-2xl border border-white/15 bg-[#1f2124] p-4 text-white shadow-2xl">
        <div className="mb-3 flex items-center gap-2">
          <button
            type="button"
            onClick={back}
            className="min-h-11 rounded-lg border border-white/25 px-4 font-semibold hover:bg-white/10"
          >
            ‹ Terug
          </button>
          <h2 className="flex-1 text-center text-xl font-bold">
            {flowTitle(spec)}
            {step && <span className="block text-base font-medium text-white/70">{step.title}</span>}
          </h2>
          <button
            type="button"
            onClick={() => onClose()}
            className="min-h-11 rounded-lg border border-white/25 px-4 font-semibold hover:bg-white/10"
          >
            Annuleren
          </button>
        </div>
        {error && <p className="mb-2 text-sm font-semibold text-red-300">{error}</p>}
        {step ? body(step) : <p className="py-6 text-center text-white/70">Opslaan…</p>}
      </div>
    </div>
  )
}
