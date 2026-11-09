import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [error, setError] = useState('')

  async function google() {
    if (!supabase) return
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
    if (error) {
      setError(error.message)
      setStatus('error')
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!supabase) return
    setStatus('sending')
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    })
    if (error) {
      setError(error.message)
      setStatus('error')
    } else {
      setStatus('sent')
    }
  }

  return (
    <div className="mx-auto max-w-sm py-10">
      <h2 className="mb-1 text-2xl font-bold">Inloggen</h2>
      <button
        type="button"
        onClick={google}
        className="mb-4 mt-4 flex min-h-11 w-full items-center justify-center gap-3 cursor-pointer rounded-lg border border-slate-300 bg-white font-semibold text-slate-800 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 hover:shadow active:scale-[0.98] active:bg-slate-100"
      >
        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
          <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"/>
          <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z"/>
          <path fill="#FBBC05" d="M10.5 28.7a14.5 14.5 0 0 1 0-9.4l-7.9-6.1a24 24 0 0 0 0 21.6l7.9-6.1z"/>
          <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.500 42.600 14.600 48 24 48z"/>
        </svg>
        Doorgaan met Google
      </button>
      <p className="mb-3 text-center text-xs text-slate-500">of met e-mail</p>
      <p className="mb-3 text-sm text-slate-600">
        Vul je e-mailadres in. Je krijgt een link om in te loggen, een wachtwoord is niet nodig.
      </p>
      {status === 'sent' ? (
        <p role="status" className="rounded-lg bg-emerald-50 p-4 text-sm text-emerald-900">
          Link verstuurd naar <strong>{email}</strong>. Open die mail op dit apparaat en klik op de
          link.
        </p>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <label className="block text-sm font-medium" htmlFor="login-email">
            E-mailadres
          </label>
          <input
            id="login-email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="min-h-11 w-full rounded-lg border border-slate-300 px-3"
          />
          <button
            type="submit"
            disabled={status === 'sending'}
            className="min-h-11 w-full cursor-pointer rounded-lg font-semibold text-white transition hover:brightness-110 active:scale-[0.98] active:brightness-90 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:brightness-100"
            style={{ background: 'var(--brand)' }}
          >
            {status === 'sending' ? 'Versturen…' : 'Stuur inloglink'}
          </button>
          {status === 'error' && (
            <p role="alert" className="text-sm text-red-700">
              {error}
            </p>
          )}
        </form>
      )}
      <p className="mt-6 text-xs text-slate-500">
        Inloggen is optioneel. Zonder account werkt Backhand lokaal op dit apparaat, ook offline.
      </p>
    </div>
  )
}
