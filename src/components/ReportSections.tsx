import { useEffect, useState } from 'react'
import GoalGrid from './GoalGrid'
import { BounceMap } from './HalfCourt'
import ShotCard from './ShotCard'
import { repo } from '../db/repo'
import { hasShotDetail, isShot, keeperGrids } from '../lib/shots'
import type { Action, Match, Player } from '../types'

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
  teamIds: string[]
}) {
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
