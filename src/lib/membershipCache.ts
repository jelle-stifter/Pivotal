import type { Membership } from './cloud'

/**
 * Last known memberships of the logged-in account, kept on the device so the
 * app knows your role without internet (a coach in a hall without wifi).
 */
const KEY = 'backhand.memberships'
export const MEMBERSHIPS_EVENT = 'backhand-memberships'

export interface CachedMemberships {
  uid: string | null
  list: Membership[]
}

const EMPTY: CachedMemberships = { uid: null, list: [] }

export function loadMemberships(): CachedMemberships {
  try {
    const raw = globalThis.localStorage?.getItem(KEY)
    if (!raw) return EMPTY
    const data = JSON.parse(raw) as CachedMemberships
    return Array.isArray(data.list) ? data : EMPTY
  } catch {
    return EMPTY
  }
}

export function saveMemberships(uid: string | null, list: Membership[]) {
  // Unchanged: do not wake every screen up again.
  if (JSON.stringify(loadMemberships()) === JSON.stringify(uid === null ? EMPTY : { uid, list })) return
  try {
    if (uid === null) globalThis.localStorage?.removeItem(KEY)
    else globalThis.localStorage?.setItem(KEY, JSON.stringify({ uid, list }))
  } catch {
    // Storage blocked: the app then simply behaves as if not logged in.
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(MEMBERSHIPS_EVENT))
}

/** True when this device has at least one approved online team. */
export function hasOnlineTeams(): boolean {
  return loadMemberships().list.some((m) => m.status === 'approved')
}
