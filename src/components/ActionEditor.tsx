import { useState } from 'react'
import { repo } from '../db/repo'
import { ACTION_META, KEEPER_FACED_TYPES } from '../lib/actions'
import { POSITIONS } from '../lib/positions'
import { ACTION_TYPES, type Action, type ActionType, type Match, type PositionCode, type Player } from '../types'

const POSITION_TYPES: ActionType[] = ['goal', 'penalty_goal', 'shot', 'off_target']

/**
 * Change one action: type, player, keeper, shooter (after a stop) and
 * position. Empty = still to fill in. Used in the live history and in the
 * report ("Nog invullen").
 */
export default function ActionEditor({
  action,
  match,
  players,
  dark = false,
  onClose,
}: {
  action: Action
  match: Match
  players: Player[]
  dark?: boolean
  onClose: () => void
}) {
  const [type, setType] = useState<ActionType>(action.type)
  const [playerId, setPlayerId] = useState(action.playerId)
  const [keeperId, setKeeperId] = useState(action.goalkeeperId ?? '')
  const [shooterId, setShooterId] = useState(action.shooterId ?? '')
  const [position, setPosition] = useState<PositionCode | ''>(action.position ?? '')
  const [error, setError] = useState('')

  const mine = players.filter((p) => p.teamId === action.teamId).sort((a, b) => a.number - b.number)
  const opposingId = action.teamId === match.homeTeamId ? match.awayTeamId : match.homeTeamId
  const opposing = players.filter((p) => p.teamId === opposingId).sort((a, b) => a.number - b.number)
  const label = (p: Player) => `#${p.number} ${p.name}`
  const faced = KEEPER_FACED_TYPES.includes(type)
  const isStaff = Boolean(action.staffId)

  async function save() {
    try {
      await repo.updateAction(action.id, {
        type,
        playerId,
        ...(faced ? { goalkeeperId: keeperId } : {}),
        ...(action.type === 'save' ? { shooterId: shooterId || undefined } : {}),
        ...(POSITION_TYPES.includes(type) && position ? { position } : {}),
      })
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Opslaan mislukt')
    }
  }

  async function remove() {
    if (!confirm('Deze actie verwijderen? De stand wordt opnieuw berekend.')) return
    await repo.deleteAction(action.id)
    onClose()
  }

  const field = dark
    ? 'min-h-11 w-full rounded-lg border border-white/20 bg-black/30 px-2 text-white'
    : 'field w-full'
  const lbl = dark ? 'block text-sm font-semibold text-white/80' : 'label'
  const btn = dark
    ? 'min-h-11 rounded-lg border border-white/30 px-4 font-semibold hover:bg-white/10'
    : 'btn'

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={lbl}>
          Type
          <select className={field} value={type} onChange={(e) => setType(e.target.value as ActionType)}>
            {ACTION_TYPES.map((t) => (
              <option key={t} value={t}>
                {ACTION_META[t].label}
              </option>
            ))}
          </select>
        </label>
        {!isStaff && (
          <label className={lbl}>
            {action.type === 'save' ? 'Keeper' : 'Speler'}
            <select className={field} value={playerId} onChange={(e) => setPlayerId(e.target.value)}>
              <option value="">Nog invullen</option>
              {mine.map((p) => (
                <option key={p.id} value={p.id}>
                  {label(p)}
                </option>
              ))}
            </select>
          </label>
        )}
        {faced && (
          <label className={lbl}>
            Keeper
            <select className={field} value={keeperId} onChange={(e) => setKeeperId(e.target.value)}>
              <option value="">Nog invullen</option>
              {opposing.map((p) => (
                <option key={p.id} value={p.id}>
                  {label(p)}
                  {p.isGoalkeeper ? ' (keeper)' : ''}
                </option>
              ))}
            </select>
          </label>
        )}
        {action.type === 'save' && (
          <label className={lbl}>
            Schutter (tegenstander)
            <select className={field} value={shooterId} onChange={(e) => setShooterId(e.target.value)}>
              <option value="">Nog invullen</option>
              {opposing.map((p) => (
                <option key={p.id} value={p.id}>
                  {label(p)}
                </option>
              ))}
            </select>
          </label>
        )}
        {POSITION_TYPES.includes(type) && (
          <label className={lbl}>
            Positie
            <select
              className={field}
              value={position}
              onChange={(e) => setPosition(e.target.value as PositionCode | '')}
            >
              <option value="">Geen</option>
              {POSITIONS.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.code} · {p.label}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      {error && <p className={dark ? 'text-sm font-semibold text-red-300' : 'alert'}>{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" className={dark ? `${btn} bg-white/15` : 'btn btn-primary'} onClick={() => void save()}>
          Opslaan
        </button>
        <button type="button" className={btn} onClick={onClose}>
          Annuleer
        </button>
        <button
          type="button"
          className={dark ? `${btn} ml-auto border-red-400/60 text-red-200` : 'btn btn-danger ml-auto'}
          onClick={() => void remove()}
        >
          Verwijderen
        </button>
      </div>
    </div>
  )
}
