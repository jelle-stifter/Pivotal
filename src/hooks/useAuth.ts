import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export interface AuthState {
  /** Auth is still being checked (first render). */
  loading: boolean
  session: Session | null
}

/**
 * Current login session. Works offline: Supabase keeps the session in
 * localStorage, so a logged-in coach stays logged in without internet.
 */
export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({ loading: Boolean(supabase), session: null })

  useEffect(() => {
    if (!supabase) return
    let alive = true
    supabase.auth.getSession().then(({ data }) => {
      if (alive) setState({ loading: false, session: data.session })
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setState({ loading: false, session })
    })
    return () => {
      alive = false
      sub.subscription.unsubscribe()
    }
  }, [])

  return state
}
