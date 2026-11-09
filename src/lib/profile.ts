import { supabase } from './supabase'

/**
 * The name you choose for your account (for example coach "Robin", player
 * "Jelle"). It is shown to your team mates instead of your Google name.
 */
const KEY = 'backhand.displayName'
export const NAME_EVENT = 'backhand-name'
export const MAX_NAME = 40

export function loadCachedName(uid: string): string | null {
  try {
    const raw = globalThis.localStorage?.getItem(KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as { uid: string; name: string }
    return data.uid === uid && data.name ? data.name : null
  } catch {
    return null
  }
}

export function cacheName(uid: string, name: string) {
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify({ uid, name }))
  } catch {
    // Storage blocked: the name is then fetched again next time.
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(NAME_EVENT))
}

/** Trimmed name, or an error text when it is not allowed. */
export function checkName(input: string): { name: string } | { error: string } {
  const name = input.trim().replace(/\s+/g, ' ')
  if (name.length === 0) return { error: 'Vul een naam in.' }
  if (name.length > MAX_NAME) return { error: `Maximaal ${MAX_NAME} tekens.` }
  return { name }
}

export async function fetchMyName(uid: string): Promise<string | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', uid)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return (data?.display_name as string | undefined) || null
}

export async function saveMyName(uid: string, name: string): Promise<void> {
  if (!supabase) throw new Error('Online functies zijn niet ingesteld')
  const { data, error } = await supabase
    .from('profiles')
    .update({ display_name: name })
    .eq('id', uid)
    .select('id')
  if (error) throw new Error(error.message)
  if (!data || data.length === 0) {
    // No profile row yet: create it.
    const { error: e2 } = await supabase.from('profiles').insert({ id: uid, display_name: name })
    if (e2) throw new Error(e2.message)
  }
}
