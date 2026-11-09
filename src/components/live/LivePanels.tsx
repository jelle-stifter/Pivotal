import { formatPenaltyTimes, type ActivePenalty } from '../../lib/clock'
import type { ScorerRow } from '../../lib/live'
import { positionLabel } from '../../lib/positions'
import type { Player, Team } from '../../types'

function ScorerList({
  title,
  color,
  rows,
  players,
}: {
  title: string
  color: string
  rows: ScorerRow[]
  players: Player[]
}) {
  return (
    <section aria-label={title}>
      <h3
        className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-wide"
        style={{ color }}
      >
        <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: color }} />
        {title}
      </h3>
      {rows.length === 0 ? (
        <p className="text-sm text-white/50">Nog geen doelpunten</p>
      ) : (
        <ul className="space-y-1">
          {rows.map((r) => {
            const p = players.find((x) => x.id === r.playerId)
            return (
              <li key={r.playerId} className="rounded-md bg-white/5 px-2 py-1.5 text-sm">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate font-semibold">
                    #{p?.number ?? '?'} <span className="font-normal text-white/70">{p?.name}</span>
                  </span>
                  <span className="shrink-0 tabular-nums">
                    <strong>
                      {r.goals}/{r.onTarget}
                    </strong>{' '}
                    <span className="text-white/70">{Math.round(r.pct * 100)}%</span>
                  </span>
                </div>
                {r.topPosition && (
                  <div className="text-xs text-white/55">{positionLabel(r.topPosition)}</div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

/** Side panel: top scorers of the opponent above those of our own team. */
export function ScorersPanel({
  opponent,
  own,
  players,
  colors,
}: {
  opponent: ScorerRow[]
  own: ScorerRow[]
  players: Player[]
  colors: { own: string; opp: string }
}) {
  return (
    <aside
      className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto rounded-xl bg-black/25 p-3"
      aria-label="Topscorers"
    >
      <ScorerList title="Tegenstander" color={colors.opp} rows={opponent} players={players} />
      <ScorerList title="Eigen team" color={colors.own} rows={own} players={players} />
    </aside>
  )
}

/** Running 2-minute suspensions, e.g. "#12 uit 6:10, terug 8:10, nog 1:30". */
export function PenaltyList({
  penalties,
  players,
  teams,
  colors,
  ownTeamId,
}: {
  penalties: ActivePenalty[]
  players: Player[]
  teams: Team[]
  colors: { own: string; opp: string }
  ownTeamId: string
}) {
  return (
    <section
      className="min-h-0 flex-1 overflow-y-auto rounded-xl bg-black/25 p-3"
      aria-label="Lopende 2-minutenstraffen"
    >
      <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-white/60">2 minuten</h3>
      {penalties.length === 0 ? (
        <p className="text-sm text-white/50">Geen lopende straffen</p>
      ) : (
        <ul className="space-y-1">
          {penalties.map((p) => {
            const player = players.find((x) => x.id === p.playerId)
            const staff = teams.flatMap((t) => t.staff ?? []).find((s) => s.id === p.staffId)
            const who = player ? `#${player.number}` : (staff?.name ?? '?')
            return (
              <li
                key={p.actionId}
                className="flex items-center gap-2 rounded-md bg-white/5 px-2 py-1.5 text-sm"
              >
                <span
                  aria-hidden
                  className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: p.teamId === ownTeamId ? colors.own : colors.opp }}
                />
                <span>
                  <strong>{who}</strong> {formatPenaltyTimes(p)}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
