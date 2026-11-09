import { useEffect, useState } from 'react'
import { cacheName, fetchMyName, loadCachedName, NAME_EVENT, saveMyName } from '../lib/profile'
import { useAuth } from './useAuth'

/** My account name: the chosen one, else the Google name or the start of the e-mail. */
export function useDisplayName() {
  const { session } = useAuth()
  const uid = session?.user.id
  const fallback =
    (session?.user.user_metadata?.full_name as string | undefined) ??
    session?.user.email?.split('@')[0] ??
    'Scorer'
  const [, bump] = useState(0)

  useEffect(() => {
    const on = () => bump((n) => n + 1)
    window.addEventListener(NAME_EVENT, on)
    return () => window.removeEventListener(NAME_EVENT, on)
  }, [])

  // Fetch the saved name once per login (works offline from the cache).
  useEffect(() => {
    if (!uid) return
    let alive = true
    fetchMyName(uid)
      .then((n) => alive && n && cacheName(uid, n))
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [uid])

  const name = (uid ? loadCachedName(uid) : null) ?? fallback

  async function save(next: string) {
    if (!uid) throw new Error('Niet ingelogd')
    await saveMyName(uid, next)
    cacheName(uid, next)
  }

  return { name, save }
}
