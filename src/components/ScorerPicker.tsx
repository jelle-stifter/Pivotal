import { useEffect, useState } from 'react'
import { repo } from '../db/repo'
import { useMemberships } from '../hooks/useAccess'
import { listMembers, type Member } from '../lib/cloud'
import type { Match } from '../types'

/**
 * Coach/assistant picks who scores one match (for example a player when the
 * coach cannot come). Only shown to staff of an online team in this match.
 */
export default function ScorerPicker({ match }: { match: Match }) {
  const { list } = useMemberships()
  const staffTeam = list.find(
    (m) =>
      m.status === 'approved' &&
      m.role !== 'player' &&
      (m.teamId === match.homeTeamId || m.teamId === match.awayTeamId),
  )
  const [members, setMembers] = useState<Member[] | null>(null)

  const teamId = staffTeam?.teamId
  useEffect(() => {
    if (!teamId) return
    let alive = true
    listMembers(teamId)
      .then((m) => alive && setMembers(m.filter((x) => x.status === 'approved')))
      .catch(() => alive && setMembers(null))
    return () => {
      alive = false
    }
  }, [teamId])

  if (!staffTeam || !members) return null

  return (
    <label className="mt-1 flex flex-wrap items-center gap-2 text-sm font-normal text-slate-600">
      Scorer
      <select
        className="field !min-h-9 !w-auto py-1"
        value={match.scorerId ?? ''}
        onChange={(e) => void repo.updateMatch(match.id, { scorerId: e.target.value || undefined })}
        aria-label="Scorer van deze wedstrijd"
      >
        <option value="">Coach of assistent</option>
        {members
          .filter((m) => m.role === 'player')
          .map((m) => (
            <option key={m.userId} value={m.userId}>
              {m.name}
            </option>
          ))}
      </select>
    </label>
  )
}
