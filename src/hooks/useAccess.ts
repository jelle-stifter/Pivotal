import { useEffect, useState } from 'react'
import { matchAccess, type Access } from '../lib/access'
import {
  loadMemberships,
  MEMBERSHIPS_EVENT,
  type CachedMemberships,
} from '../lib/membershipCache'
import type { Match } from '../types'

/** Memberships cached on this device; updates when they are refreshed. */
export function useMemberships(): CachedMemberships {
  const [state, setState] = useState(loadMemberships)
  useEffect(() => {
    const on = () => setState(loadMemberships())
    window.addEventListener(MEMBERSHIPS_EVENT, on)
    window.addEventListener('storage', on)
    return () => {
      window.removeEventListener(MEMBERSHIPS_EVENT, on)
      window.removeEventListener('storage', on)
    }
  }, [])
  return state
}

export function useMatchAccess(
  match: Pick<Match, 'homeTeamId' | 'awayTeamId' | 'scorerId'> | undefined,
): Access {
  const { uid, list } = useMemberships()
  if (!match) return 'score'
  return matchAccess(match, list, uid)
}
