import { Fragment, useState } from 'react'
import Court from './Court'
import { ACTION_META } from '../lib/actions'
import { hasPosition, type Point } from '../lib/court'
import { periodLabel } from '../lib/periods'
import { editedClockMs, formatClock } from '../lib/time'
import {
  ACTION_TYPES,
  type Action,
  type ActionType,
  type MatchFormat,
  type Player,
} from '../types'

export interface ActionPatch {
  playerId: string
  type: ActionType
  period: number
  matchClockMs: number
  /** Attack-normalized position; undefined clears a stored position. */
  x: number | undefined
  y: number | undefined
}

interface Props {
  actions: Action[] // newest first
  players: Player[]
  teamNames: Record<string, string>
  format: MatchFormat
  onSave: (id: string, patch: ActionPatch) => Promise<void>
  onDelete: (id: string) => void
}

export default function ActionList({
  actions,
  players,
  teamNames,
  format,
  onSave,
  onDelete,
}: Props) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const playerById = new Map(players.map((p) => [p.id, p]))
  const who = (id: string) => {
    const p = playerById.get(id)
    return p ? `#${p.number} ${p.name}` : '?'
  }

  if (actions.length === 0)
    return <p className="py-6 text-center text-slate-500">Nog geen acties.</p>

  return (
    <div className="overflow-x-auto">
      <table className="table">
        <thead>
          <tr>
            <th>Tijd</th>
            <th>Periode</th>
            <th>Team</th>
            <th>Speler</th>
            <th>Actie</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {actions.map((a) =>
            a.id === editingId ? (
              <EditRow
                key={a.id}
                action={a}
                players={players.filter((p) => p.teamId === a.teamId)}
                teamName={teamNames[a.teamId] ?? '?'}
                format={format}
                onCancel={() => setEditingId(null)}
                onSave={async (patch) => {
                  await onSave(a.id, patch)
                  setEditingId(null)
                }}
              />
            ) : (
              <tr key={a.id}>
                <td className="tabular-nums">{formatClock(a.matchClockMs)}</td>
                <td>{periodLabel(format, a.period)}</td>
                <td>{teamNames[a.teamId] ?? '?'}</td>
                <td>{who(a.playerId)}</td>
                <td className="font-semibold">
                  {ACTION_META[a.type].label}
                  {hasPosition(a) && (
                    <span
                      className="gk-badge ml-2"
                      title="Positie opgeslagen"
                      aria-label="Positie opgeslagen"
                    >
                      pos
                    </span>
                  )}
                </td>
                <td className="whitespace-nowrap text-right">
                  <button
                    className="btn"
                    onClick={() => setEditingId(a.id)}
                    aria-label={`Bewerk ${ACTION_META[a.type].label} ${who(a.playerId)}`}
                  >
                    Bewerk
                  </button>{' '}
                  <button
                    className="btn btn-danger"
                    onClick={() => onDelete(a.id)}
                    aria-label={`Verwijder ${ACTION_META[a.type].label} ${who(a.playerId)}`}
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ),
          )}
        </tbody>
      </table>
    </div>
  )
}

function EditRow({
  action,
  players,
  teamName,
  format,
  onCancel,
  onSave,
}: {
  action: Action
  players: Player[]
  teamName: string
  format: MatchFormat
  onCancel: () => void
  onSave: (patch: ActionPatch) => Promise<void>
}) {
  const [time, setTime] = useState(formatClock(action.matchClockMs))
  const [period, setPeriod] = useState(action.period)
  const [playerId, setPlayerId] = useState(action.playerId)
  const [type, setType] = useState<ActionType>(action.type)
  const [pos, setPos] = useState<Point | null>(
    hasPosition(action) ? { x: action.x, y: action.y } : null,
  )
  const [showCourt, setShowCourt] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    const ms = editedClockMs(action.matchClockMs, time)
    if (ms === null) return setError('Tijd als mm:ss')
    setError('')
    await onSave({
      playerId,
      type,
      period,
      matchClockMs: ms,
      x: pos?.x,
      y: pos?.y,
    })
  }

  return (
    <Fragment>
    <tr style={{ background: 'var(--brand-soft)' }}>
      <td>
        <input
          className="field w-24 tabular-nums"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          aria-label="Tijd (mm:ss)"
          aria-invalid={error ? true : undefined}
        />
        {error && <div className="text-xs text-red-700">{error}</div>}
      </td>
      <td>
        <select
          className="field"
          value={period}
          onChange={(e) => setPeriod(Number(e.target.value))}
          aria-label="Periode"
        >
          {Array.from({ length: format }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              {periodLabel(format, n)}
            </option>
          ))}
        </select>
      </td>
      <td>{teamName}</td>
      <td>
        <select
          className="field"
          value={playerId}
          onChange={(e) => setPlayerId(e.target.value)}
          aria-label="Speler"
        >
          {players.map((p) => (
            <option key={p.id} value={p.id}>
              #{p.number} {p.name}
            </option>
          ))}
        </select>
      </td>
      <td>
        <select
          className="field"
          value={type}
          onChange={(e) => setType(e.target.value as ActionType)}
          aria-label="Actie"
        >
          {ACTION_TYPES.map((t) => (
            <option key={t} value={t}>
              {ACTION_META[t].label}
            </option>
          ))}
        </select>
      </td>
      <td className="whitespace-nowrap text-right">
        <button className="btn" onClick={() => setShowCourt((v) => !v)}>
          Positie{pos ? ' ✓' : ''}
        </button>{' '}
        <button className="btn btn-primary" onClick={() => void save()}>
          Opslaan
        </button>{' '}
        <button className="btn" onClick={onCancel}>
          Annuleer
        </button>
      </td>
    </tr>
    {showCourt && (
      <tr style={{ background: 'var(--brand-soft)' }}>
        <td colSpan={6}>
          <div className="mx-auto max-w-xl space-y-2 py-2">
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
              <span>
                Veld vanuit het aanvalsperspectief: {teamName} valt aan naar
                rechts.
              </span>
              {pos && (
                <button className="btn" onClick={() => setPos(null)}>
                  Wis positie
                </button>
              )}
            </div>
            <Court
              label="Veld: klik om de positie van deze actie te zetten of te verplaatsen"
              pending={pos}
              onPick={setPos}
            />
            <p className="text-xs text-slate-500">
              {pos
                ? 'Klik opnieuw om te verplaatsen. Vergeet niet op Opslaan te klikken.'
                : 'Nog geen positie. Klik op het veld om er een te zetten.'}
            </p>
          </div>
        </td>
      </tr>
    )}
    </Fragment>
  )
}
