import type { ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/schema'
import { useMatchAccess } from '../hooks/useAccess'

/**
 * Link to the live scoring screen. Only shown to people who may score;
 * a normal player only sees the statistics links.
 */
export default function LiveLink({
  matchId,
  className,
  label,
  children,
}: {
  matchId: string
  className?: string
  label?: string
  children: ReactNode
}) {
  const match = useLiveQuery(() => db.matches.get(matchId), [matchId])
  const access = useMatchAccess(match)
  if (access !== 'score') return null
  return (
    <a href={`#/match/${matchId}`} className={className} aria-label={label}>
      {children}
    </a>
  )
}
