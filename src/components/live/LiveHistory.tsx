import { useState } from 'react'
import ActionEditor from '../ActionEditor'
import { ACTION_META, SCORING_TYPES } from '../../lib/actions'
import { byTime, missingFields, runningScores, TODO_LABEL } from '../../lib/history'
import { formatClock } from '../../lib/time'
import { textOn } from '../../lib/teamColors'
import type { Action, ActionType, Match, Player } from '../../types'

/** Clear names for the history (the report keeps the short names). */
const LABEL: Partial<Record<ActionType, string>> = {
  goal: 'Doelpunt',
  penalty_goal: '7 meter doelpunt',
  penalty_miss: '7 meter niet op doel',
  penalty_saved: '7 meter gestopt',
  shot: 'Miss',
  save: 'Stop',
}
const labelOf = (t: ActionType) => LABEL[t] ?? ACTION_META[t].label

/**
 * Left column of the live screen: every action of the match, newest first.
 * Per action: team, what happened, who, the clock and the score. Tap one to
 * change or delete it.
 */
export default function LiveHistory({
  match,
  actions,
  players,
  colorOf,
  teamLabel,
}: {
  match: Match
  actions: Action[]
  players: Player[]
  /** Team colour per team id. */
  colorOf: (teamId: string) => string
  /** Short team name per team id. */
  teamLabel: (teamId: string) => string
}) {
  const [editing, setEditing] = useState<Action | null>(null)
  const scores = runningScores(actions, match.homeTeamId, match.awayTeamId)
  const rows = byTime(actions).reverse()
  const who = (a: Action) => {
    const p = players.find((x) => x.id === a.playerId)
    return p ? `#${p.number} ${p.name}` : ''
  }

  return (
    <aside className="flex min-h-0 flex-col rounded-xl bg-black/25 p-2" aria-label="Actiegeschiedenis">
      <h3 className="mb-1 px-1 text-xs font-bold uppercase tracking-wide text-white/60">Geschiedenis</h3>
      {rows.length === 0 ? (
        <p className="px-1 text-sm text-white/50">Nog geen acties</p>
      ) : (
        <ul className="min-h-0 flex-1 space-y-1.5 overflow-y-auto">
          {rows.map((a) => {
            const todo = missingFields(a)
            const s = scores.get(a.id)
            const color = colorOf(a.teamId)
            const goal = SCORING_TYPES.includes(a.type)
            return (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => setEditing(a)}
                  className="w-full rounded-md bg-white/5 py-1.5 pl-2.5 pr-2 text-left hover:bg-white/10"
                  style={{ borderLeft: `4px solid ${color}` }}
                >
                  <span className="flex items-center gap-2">
                    <span
                      className="shrink-0 rounded px-1.5 text-xs font-extrabold"
                      style={{ background: color, color: textOn(color) }}
                    >
                      {teamLabel(a.teamId)}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-bold">{labelOf(a.type)}</span>
                    {s && (
                      <span
                        className={`shrink-0 text-sm tabular-nums ${goal ? 'font-extrabold text-white' : 'text-white/50'}`}
                      >
                        {s.home}–{s.away}
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 flex items-center gap-2 text-xs text-white/70">
                    <span className="shrink-0 tabular-nums text-white/50">{formatClock(a.matchClockMs)}</span>
                    <span className="min-w-0 flex-1 truncate">
                      {who(a) || (todo.includes('speler') ? '' : '—')}
                      {a.position ? ` · ${a.position}` : ''}
                    </span>
                  </span>
                  {todo.length > 0 && (
                    <span className="mt-1 block rounded bg-amber-400/20 px-1.5 text-xs font-semibold text-amber-200">
                      Nog invullen:{' '}
                      {todo
                        .map((f) => (f === 'speler' && a.type === 'save' ? 'keeper' : TODO_LABEL[f]))
                        .join(', ')}
                    </span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {editing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3"
          role="dialog"
          aria-modal="true"
          aria-label="Actie aanpassen"
        >
          <div className="w-full max-w-xl rounded-2xl border border-white/15 bg-[#1f2124] p-4 text-white shadow-2xl">
            <h2 className="mb-3 text-xl font-bold">
              Actie aanpassen · <span className="tabular-nums">{formatClock(editing.matchClockMs)}</span>
            </h2>
            <ActionEditor action={editing} match={match} players={players} dark onClose={() => setEditing(null)} />
          </div>
        </div>
      )}
    </aside>
  )
}
