import { useState } from 'react'
import HalfCourt, { type HalfMode } from './HalfCourt'
import GoalGrid from './GoalGrid'
import { repo } from '../db/repo'
import { ACTION_META } from '../lib/actions'
import { hasPosition } from '../lib/court'
import { CELL_NAMES, SHOT_TYPES } from '../lib/shots'
import { formatClock } from '../lib/time'
import type { Action, ActionType, Player } from '../types'

type P = { x: number; y: number }

/** One shot in the post-match report: a read-only picture, or the editor. */
export default function ShotCard({
  action,
  players,
  detail,
}: {
  action: Action
  players: Player[] // players of the shooting team
  /** True when something (cell, bounce, line, note) is filled in. */
  detail: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [playerId, setPlayerId] = useState(action.playerId)
  const [type, setType] = useState<ActionType>(action.type)
  const [shooter, setShooter] = useState<P | null>(hasPosition(action) ? { x: action.x, y: action.y } : null)
  const [bounce, setBounce] = useState<P | null>(action.bounce ?? null)
  const [cell, setCell] = useState<number | undefined>(action.goalCell)
  const [path, setPath] = useState<P[]>(action.path ?? [])
  const [note, setNote] = useState(action.note ?? '')
  const [mode, setMode] = useState<HalfMode>('shooter')
  const [error, setError] = useState('')

  const who = (id: string) => {
    const p = players.find((x) => x.id === id)
    return p ? `#${p.number} ${p.name}` : '?'
  }

  function open() {
    setPlayerId(action.playerId)
    setType(action.type)
    setShooter(hasPosition(action) ? { x: action.x, y: action.y } : null)
    setBounce(action.bounce ?? null)
    setCell(action.goalCell)
    setPath(action.path ?? [])
    setNote(action.note ?? '')
    setMode('shooter')
    setError('')
    setEditing(true)
  }

  async function save() {
    try {
      await repo.updateAction(action.id, {
        playerId,
        type,
        x: shooter?.x,
        y: shooter?.y,
        bounce: bounce ?? undefined,
        goalCell: cell,
        path: path.length > 1 ? path : undefined,
        note: note.trim() || undefined,
      })
      setEditing(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Opslaan mislukt')
    }
  }

  const head = (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="font-semibold">
        <span className="tabular-nums text-slate-500">{formatClock(action.matchClockMs)}</span>{' '}
        {who(action.playerId)} · {ACTION_META[action.type].label}
        {action.goalCell !== undefined && (
          <span className="font-normal text-slate-600"> · {CELL_NAMES[action.goalCell]}</span>
        )}
      </div>
      {!editing && (
        <button
          className="btn no-print"
          onClick={open}
          aria-label={`Bewerk ${ACTION_META[action.type].label} ${who(action.playerId)}`}
        >
          Bewerk
        </button>
      )}
    </div>
  )

  if (!editing)
    return (
      <article className={`card ${detail ? '' : 'no-print'}`}>
        {head}
        {detail && (
          <div className="mx-auto mt-3 w-full max-w-[22rem]">
            <GoalGrid value={action.goalCell} label="Doel, gezien vanuit de schutter" />
            <HalfCourt
              shooter={hasPosition(action) ? { x: action.x, y: action.y } : null}
              bounce={action.bounce}
              goalCell={action.goalCell}
              path={action.path}
              label="Baltraject"
            />
            {action.note && <p className="mt-2 whitespace-pre-wrap text-sm">{action.note}</p>}
          </div>
        )}
      </article>
    )

  const modes: [HalfMode, string][] = [
    ['shooter', 'Schietpositie'],
    ['bounce', 'Stuit'],
    ['draw', 'Baltraject'],
  ]
  return (
    <article className="card no-print" style={{ borderColor: 'var(--brand)' }}>
      {head}
      <div className="mt-3 flex flex-wrap gap-3">
        <label className="label">
          Speler
          <select className="field" value={playerId} onChange={(e) => setPlayerId(e.target.value)}>
            {players.map((p) => (
              <option key={p.id} value={p.id}>
                #{p.number} {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="label">
          Actie
          <select className="field" value={type} onChange={(e) => setType(e.target.value as ActionType)}>
            {SHOT_TYPES.map((t) => (
              <option key={t} value={t}>
                {ACTION_META[t].label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mx-auto mt-3 w-full max-w-[22rem] space-y-2">
        <div className="segmented" role="group" aria-label="Wat teken je">
          {modes.map(([m, text]) => (
            <button
              key={text}
              type="button"
              className="seg-btn"
              aria-pressed={mode === m}
              onClick={() => setMode(m)}
            >
              {text}
            </button>
          ))}
        </div>
        <div>
          <div className="mb-1 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
            Doel (vanuit de schutter)
          </div>
          <GoalGrid value={cell} onPick={setCell} label="Kies het vak waar de bal in het doel ging" />
          <HalfCourt
            shooter={shooter}
            bounce={bounce}
            goalCell={cell}
            path={path}
            mode={mode}
            onShooter={setShooter}
            onBounce={setBounce}
            onPath={setPath}
            label="Halve veld: tik de schietpositie, de stuit of teken het baltraject"
          />
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <button className="btn" onClick={() => setShooter(null)} disabled={!shooter}>
            Wis schietpositie
          </button>
          <button className="btn" onClick={() => setBounce(null)} disabled={!bounce}>
            Wis stuit
          </button>
          <button className="btn" onClick={() => setPath([])} disabled={path.length === 0}>
            Wis baltraject
          </button>
        </div>
      </div>

      <label className="label mt-3">
        Notitie bij deze actie
        <textarea className="field w-full py-2" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      {error && <p className="alert mt-2">{error}</p>}
      <div className="mt-3 flex gap-2">
        <button className="btn btn-primary" onClick={() => void save()}>
          Opslaan
        </button>
        <button className="btn" onClick={() => setEditing(false)}>
          Annuleer
        </button>
      </div>
    </article>
  )
}
