import { useEffect, useState } from 'react'
import GoalGrid from './GoalGrid'
import { BounceMap } from './HalfCourt'
import ShotCard from './ShotCard'
import ActionEditor from './ActionEditor'
import { repo } from '../db/repo'
import { ACTION_META } from '../lib/actions'
import { byTime, missingFields, runningScores, TODO_LABEL } from '../lib/history'
import { hasShotDetail, isShot, keeperGrids } from '../lib/shots'
import { formatClock } from '../lib/time'
import type { Action, Match, Player } from '../types'

const standText = (s: { home: number; away: number } | undefined) => (s ? `${s.home}–${s.away}` : '')

/** Actions with skipped fields during the match: fill them in here. */
export function TodoSection({
  match,
  actions,
  players,
  teamName,
}: {
  match: Match
  actions: Action[]
  players: Player[]
  teamName: (id: string) => string
}) {
  const [editing, setEditing] = useState<string | null>(null)
  const scores = runningScores(actions, match.homeTeamId, match.awayTeamId)
  const todo = byTime(actions).filter((a) => missingFields(a).length > 0)
  if (todo.length === 0) return null
  const who = (a: Action) => {
    const p = players.find((x) => x.id === a.playerId)
    return p ? `#${p.number} ${p.name}` : '?'
  }
  return (
    <section className="card no-print" aria-label="Nog invullen">
      <h3 className="section-title mb-1">Nog invullen ({todo.length})</h3>
      <p className="mb-3 text-sm text-slate-600">
        Deze acties zijn tijdens de wedstrijd overgeslagen. Vul de ontbrekende gegevens aan.
      </p>
      <ul className="space-y-2">
        {todo.map((a) => (
          <li key={a.id} className="rounded-lg border border-amber-300 bg-amber-50 p-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="tabular-nums text-slate-500">{formatClock(a.matchClockMs)}</span>{' '}
                <strong>{ACTION_META[a.type].label}</strong> · {teamName(a.teamId)} · {who(a)}{' '}
                <span className="tabular-nums text-slate-500">(stand {standText(scores.get(a.id))})</span>{' '}
                <span className="rounded bg-amber-200 px-1 text-xs font-semibold">
                  Nog invullen: {missingFields(a).map((f) => (f === 'speler' && a.type === 'save' ? 'keeper' : TODO_LABEL[f])).join(', ')}
                </span>
              </div>
              <button className="btn" onClick={() => setEditing(editing === a.id ? null : a.id)}>
                {editing === a.id ? 'Sluiten' : 'Aanvullen'}
              </button>
            </div>
            {editing === a.id && (
              <div className="mt-2">
                <ActionEditor action={a} match={match} players={players} onClose={() => setEditing(null)} />
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}

/** Free notes about the match: an editor on screen, plain text on paper. */
export function MatchNotes({ match }: { match: Match }) {
  const [text, setText] = useState(match.reportNote ?? '')
  useEffect(() => setText(match.reportNote ?? ''), [match.reportNote])
  const save = () => {
    const next = text.trim()
    if (next !== (match.reportNote ?? '')) void repo.updateMatch(match.id, { reportNote: next || undefined })
  }
  return (
    <section className="card" aria-label="Notities">
      <h3 className="section-title mb-2">Notities</h3>
      <textarea
        className="field no-print w-full py-2"
        rows={5}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={save}
        placeholder="Wat ging goed, wat kan beter, afspraken voor de volgende wedstrijd…"
        aria-label="Notities bij de wedstrijd"
      />
      {text.trim() && <p className="print-only whitespace-pre-wrap">{text}</p>}
    </section>
  )
}

/** All shots: change the player, type, position, ball path and goal cell. */
export function ShotsSection({
  actions,
  players,
  teamName,
  teamIds,
}: {
  actions: Action[]
  players: Player[]
  teamName: (id: string) => string
  /** [home, away] */
  teamIds: [string, string]
}) {
  const scores = runningScores(actions, teamIds[0], teamIds[1])
  const [team, setTeam] = useState('all')
  const [onlyGoals, setOnlyGoals] = useState(false)
  const shots = actions
    .filter(isShot)
    .filter((a) => team === 'all' || a.teamId === team)
    .filter((a) => !onlyGoals || a.type === 'goal' || a.type === 'penalty_goal')
    .sort((a, b) => a.matchClockMs - b.matchClockMs || a.createdAt - b.createdAt)
  return (
    <section className="space-y-3" aria-label="Doelpunten en schoten">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="section-title">Doelpunten en schoten</h3>
        <div className="no-print flex flex-wrap items-center gap-3">
          <select className="field" value={team} onChange={(e) => setTeam(e.target.value)} aria-label="Team">
            <option value="all">Beide teams</option>
            {teamIds.map((id) => (
              <option key={id} value={id}>
                {teamName(id)}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" className="checkbox" checked={onlyGoals} onChange={(e) => setOnlyGoals(e.target.checked)} />
            Alleen doelpunten
          </label>
        </div>
      </div>
      <p className="no-print text-sm text-slate-600">
        Klik op Bewerk om het baltraject, de stuit en het doelvak vast te leggen. Alleen schoten met een
        tekening of notitie komen op papier.
      </p>
      {shots.length === 0 && <p className="card text-slate-500">Geen schoten.</p>}
      {shots.map((a) => (
        <ShotCard
          key={a.id}
          action={a}
          players={players.filter((p) => p.teamId === a.teamId)}
          detail={hasShotDetail(a)}
          stand={standText(scores.get(a.id))}
        />
      ))}
    </section>
  )
}

/** Per keeper: where the shots ended in the goal (3x3) and where the ball bounced. */
export function KeeperGoalSection({ actions, players }: { actions: Action[]; players: Player[] }) {
  const grids = keeperGrids(actions)
  if (grids.length === 0) return null
  return (
    <section className="card" aria-label="Doelvakken per keeper">
      <h3 className="section-title mb-3">Doelvakken per keeper</h3>
      <div className="grid gap-6 md:grid-cols-2">
        {grids.map((g) => {
          const p = players.find((x) => x.id === g.keeperId)
          const max = Math.max(1, ...g.cells.map((c) => c.shots))
          return (
            <div key={g.keeperId} className="break-inside-avoid">
              <div className="mb-2 font-semibold">{p ? `#${p.number} ${p.name}` : 'Onbekende keeper'}</div>
              <div className="grid items-start gap-3 sm:grid-cols-2">
                <div>
                  <GoalGrid
                    label={`Doelvakken ${p?.name ?? ''}`}
                    counts={g.cells.map((c) => ({
                      main: c.shots === 0 ? '' : `${c.goals}/${c.shots}`,
                      sub: c.shots === 0 ? undefined : 'goals/schoten',
                      strength: c.shots / max,
                    }))}
                  />
                  <p className="mt-1 text-center text-xs text-slate-500">Gezien vanuit de schutter</p>
                </div>
                <div>
                  <BounceMap points={g.bounces} label={`Stuitpunten ${p?.name ?? ''}`} />
                  <p className="mt-1 text-center text-xs text-slate-500">Waar de bal stuitte</p>
                </div>
              </div>
              {g.noCell > 0 && (
                <p className="mt-1 text-xs text-slate-500">{g.noCell} schot(en) zonder doelvak ingevuld.</p>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
