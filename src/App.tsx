import { useEffect, useState } from 'react'
import TeamsPage from './pages/TeamsPage'
import MatchesPage from './pages/MatchesPage'
import LivePage from './pages/LivePage'
import StatsPage from './pages/StatsPage'
import SeasonPage from './pages/SeasonPage'
import SheetPage from './pages/SheetPage'
import HomePage from './pages/HomePage'
import PlayerPage from './pages/PlayerPage'
import LoginPage from './pages/LoginPage'
import AccountPage from './pages/AccountPage'
import RunningMatchBar from './components/RunningMatchBar'
import { useAuth } from './hooks/useAuth'
import { onlineEnabled, supabase } from './lib/supabase'
import { saveMemberships } from './lib/membershipCache'
import { startSyncEngine } from './lib/syncEngine'
import { useSyncStatus } from './hooks/useSyncStatus'

const ROUTES = [
  { path: '#/home', label: 'Overzicht' },
  { path: '#/matches', label: 'Wedstrijden' },
  { path: '#/season', label: 'Seizoen' },
  { path: '#/teams', label: 'Teams' },
] as const

function useHash() {
  const [hash, setHash] = useState(window.location.hash || '#/home')
  useEffect(() => {
    const on = () => setHash(window.location.hash || '#/home')
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return hash
}

export default function App() {
  const hash = useHash()
  const { session } = useAuth()
  const sync = useSyncStatus()
  const userId = session?.user.id

  // Automatic sync while logged in (also queues changes made without internet).
  useEffect(() => {
    if (!userId) return
    return startSyncEngine()
  }, [userId])
  const matchId = /^#\/match\/([^/?]+)/.exec(hash)?.[1] ?? null
  const statsId = /^#\/stats\/([^/?]+)/.exec(hash)?.[1] ?? null
  const playerId = /^#\/player\/([^/?]+)/.exec(hash)?.[1] ?? null
  const sheetId = /^#\/sheet\/([^/?]+)/.exec(hash)?.[1] ?? null

  return (
    <div className="flex min-h-screen flex-col">
      <header className="app-header text-white" style={{ background: 'var(--nav)' }}>
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-3 sm:gap-8 sm:px-4">
          <a href="#/home" className="flex items-center gap-2.5 no-underline">
            <img src="/favicon.svg" alt="" aria-hidden className="h-8 w-8" />
            <span className="hidden text-lg font-bold tracking-tight text-white sm:inline">
              Backhand
            </span>
          </a>
          <nav className="flex h-full min-w-0 gap-0.5 overflow-x-auto sm:gap-1" aria-label="Hoofdmenu">
            {ROUTES.map((r) => {
              const active =
                hash.startsWith(r.path) ||
                (r.path === '#/matches' && (matchId !== null || statsId !== null || sheetId !== null)) ||
                (r.path === '#/season' && playerId !== null)
              return (
                <a
                  key={r.path}
                  href={r.path}
                  aria-current={active ? 'page' : undefined}
                  className="flex min-h-11 items-center self-center rounded-md px-2.5 text-sm font-medium no-underline sm:px-3.5"
                  style={{
                    color: active ? '#fff' : '#94a3b8',
                    background: active ? 'rgb(255 255 255 / 0.1)' : 'transparent',
                  }}
                >
                  {r.label}
                </a>
              )
            })}
          </nav>
          {onlineEnabled && (
            <div className="ml-auto flex items-center gap-2 text-sm">
              {session ? (
                <>
                  {sync.state !== 'idle' || sync.pending > 0 ? (
                    <span
                      className="hidden text-xs text-slate-300 sm:inline"
                      role="status"
                      title={sync.message || undefined}
                    >
                      {sync.state === 'offline'
                        ? `Offline · ${sync.pending} wachten`
                        : sync.state === 'error'
                          ? 'Sync-fout'
                          : sync.pending > 0
                            ? `${sync.pending} versturen…`
                            : 'Synchroniseren…'}
                    </span>
                  ) : null}
                  <a
                    href="#/account"
                    className="flex min-h-11 items-center rounded-md px-2.5 font-medium text-slate-300 no-underline transition hover:bg-white/10 hover:text-white active:bg-white/20"
                  >
                    Online
                  </a>
                  <button
                    type="button"
                    onClick={() => {
                      // Forget the role on this device only when you log out on purpose.
                      saveMemberships(null, [])
                      void supabase?.auth.signOut()
                    }}
                    className="min-h-11 cursor-pointer rounded-md px-2.5 font-medium text-slate-300 transition hover:bg-white/10 hover:text-white active:bg-white/20"
                  >
                    Uitloggen
                  </button>
                </>
              ) : (
                <a
                  href="#/login"
                  className="flex min-h-11 items-center rounded-md px-2.5 font-medium text-slate-300 no-underline transition hover:bg-white/10 hover:text-white active:bg-white/20"
                >
                  Inloggen
                </a>
              )}
            </div>
          )}
        </div>
      </header>
      <RunningMatchBar currentMatchId={matchId} />
      <main className="mx-auto w-full max-w-6xl flex-1 p-4 md:py-8">
        {hash.startsWith('#/login') ? (
          session ? (
            <p className="py-10 text-center">
              Ingelogd als <strong>{session.user.email}</strong>.{' '}
              <a href="#/home">Naar overzicht</a>
            </p>
          ) : (
            <LoginPage />
          )
        ) : hash.startsWith('#/account') ? (
          session ? (
            <AccountPage />
          ) : (
            <LoginPage />
          )
        ) : playerId ? (
          <PlayerPage key={playerId} playerId={playerId} />
        ) : sheetId ? (
          <SheetPage key={sheetId} matchId={sheetId} />
        ) : statsId ? (
          <StatsPage key={statsId} matchId={statsId} />
        ) : matchId ? (
          <LivePage key={matchId} matchId={matchId} />
        ) : hash.startsWith('#/season') ? (
          <SeasonPage />
        ) : hash.startsWith('#/teams') ? (
          <TeamsPage />
        ) : hash.startsWith('#/matches') ? (
          <MatchesPage />
        ) : (
          <HomePage />
        )}
      </main>
      <footer className="app-footer">
        <strong>Backhand</strong> · handbalstatistieken · Gemaakt door{' '}
        <strong>Jelle Stifter</strong>
      </footer>
    </div>
  )
}
