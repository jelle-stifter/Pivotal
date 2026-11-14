import { useState } from 'react'
import ActionEditor from '../ActionEditor'
import { ACTION_META } from '../../lib/actions'
import { byTime, missingFields, runningScores } from '../../lib/history'
import { formatClock } from '../../lib/time'
import type { Action, Match, Player } from '../../types'

/**
 * Left column of the live screen: every action of the match, newest first,
 * with the clock and the score at that moment. Tap one to change or delete it.
 */
export default function LiveHistory({
  match,
  actions,
  players,
  colorOf,
}: {
  match: Match
  actions: Action[]
  players: Player[]
  /** Team colour per team id. */
  colorOf: (teamId: string) => string
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
        <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto">
          {rows.map((a) => {
            const todo = missingFields(a)
            const s = scores.get(a.id)
            return (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => setEditing(a)}
                  className="w-full rounded-md bg-white/5 px-2 py-1.5 text-left text-sm hover:bg-white/10"
                >
                  <span className="flex items-center gap-2">
                    <span
                      aria-hidden
                      className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: colorOf(a.teamId) }}
                    />
                    <span className="tabular-nums text-white/60">{formatClock(a.matchClockMs)}</span>
                    <span className="min-w-0 flex-1 truncate font-semibold">{ACTION_META[a.type].label}</span>
                    {s && (
                      <span className="shrink-0 tabular-nums text-white/70">
                        {s.home}–{s.away}
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 block truncate pl-[1.1rem] text-xs text-white/70">
                    {who(a)}
                    {todo.length > 0 && (
                      <span className="ml-1 rounded bg-amber-400/20 px-1 font-semibold text-amber-200">
                        Nog invullen
                      </span>
                    )}
                  </span>
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
