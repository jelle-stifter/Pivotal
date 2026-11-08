import { useEffect, useState } from 'react'
import TeamsPage from './pages/TeamsPage'
import MatchesPage from './pages/MatchesPage'
import LivePage from './pages/LivePage'
import StatsPage from './pages/StatsPage'
import SeasonPage from './pages/SeasonPage'
import SheetPage from './pages/SheetPage'
import HomePage from './pages/HomePage'
import PlayerPage from './pages/PlayerPage'

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
  const matchId = /^#\/match\/([^/?]+)/.exec(hash)?.[1] ?? null
  const statsId = /^#\/stats\/([^/?]+)/.exec(hash)?.[1] ?? null
  const playerId = /^#\/player\/([^/?]+)/.exec(hash)?.[1] ?? null
  const sheetId = /^#\/sheet\/([^/?]+)/.exec(hash)?.[1] ?? null

  return (
    <div className="flex min-h-screen flex-col">
      <header className="app-header text-white" style={{ background: 'var(--nav)' }}>
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-3 sm:gap-8 sm:px-4">
          <a href="#/home" className="flex items-center gap-2.5 no-underline">
            <span
              aria-hidden
              className="flex h-8 w-8 items-center justify-center rounded-lg text-lg font-black"
              style={{ background: 'var(--brand)' }}
            >
              P
            </span>
            <span className="hidden text-lg font-bold tracking-tight text-white sm:inline">
              Pivotal
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
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 p-4 md:py-8">
        {playerId ? (
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
        <strong>Pivotal</strong> · handbalstatistieken · Gemaakt door{' '}
        <strong>Jelle Stifter</strong>
      </footer>
    </div>
  )
}
