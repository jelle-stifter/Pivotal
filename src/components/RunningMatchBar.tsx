import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/schema'
import { useMemberships } from '../hooks/useAccess'
import { useNow } from '../hooks/useNow'
import { matchAccess } from '../lib/access'
import { formatClock } from '../lib/time'

/**
 * Shown on every screen while a match clock is running, so the coach can
 * look at statistics or the match list and jump straight back to the live
 * screen. The clock itself keeps running (see useMatchClock).
 */
export default function RunningMatchBar({ currentMatchId }: { currentMatchId: string | null }) {
  const running = useLiveQuery(
    () => db.matches.filter((m) => m.clockStartedAt !== undefined && !m.finishedAt).toArray(),
    [],
  )
  const teams = useLiveQuery(() => db.teams.toArray(), [])
  const { uid, list } = useMemberships()
  const now = useNow(1000)

  const shown = (running ?? []).filter(
    (m) => m.id !== currentMatchId && matchAccess(m, list, uid) === 'score',
  )
  if (shown.length === 0) return null
  const name = (id: string) => teams?.find((t) => t.id === id)?.name ?? '?'

  return (
    <div className="no-print" role="status" aria-live="off">
      {shown.map((m) => (
        <a
          key={m.id}
          href={`#/match/${m.id}`}
          className="flex min-h-11 items-center justify-center gap-3 bg-red-700 px-3 text-sm font-semibold text-white no-underline transition hover:bg-red-800"
        >
          <span aria-hidden>●</span>
          <span className="truncate">
            Live: {name(m.homeTeamId)} – {name(m.awayTeamId)}
          </span>
          <span className="tabular-nums">
            {formatClock(m.clockMs + (now - (m.clockStartedAt ?? now)))}
          </span>
          <span className="underline">Terug naar live</span>
        </a>
      ))}
    </div>
  )
}
