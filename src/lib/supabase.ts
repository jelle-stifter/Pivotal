import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_KEY as string | undefined

/** True when the online account features are configured. */
export const onlineEnabled = Boolean(url && key)

/**
 * null when not configured: the app then keeps working fully local,
 * exactly as before.
 */
export const supabase: SupabaseClient | null = onlineEnabled
  ? createClient(url!, key!, {
      // PKCE returns the code as ?code=..., which does not clash with the
      // #/hash routes the app uses (the implicit flow would overwrite the hash).
      auth: {
        flowType: 'pkce',
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null
