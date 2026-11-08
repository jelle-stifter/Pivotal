import type { ReactNode } from 'react'

function formatDate(iso: string) {
  const [y, m, d] = iso.split('-')
  return `${d}-${m}-${y}`
}

interface Props {
  homeName: string
  awayName: string
  homeGoals: number
  awayGoals: number
  date?: string
  location?: string
  /** Half-time score, e.g. "14 – 12". */
  half?: { home: number; away: number } | null
  /** Optional line under the score (e.g. clock and period on the live page). */
  children?: ReactNode
  live?: boolean
}

/** Dark scoreboard header shared by live, statistics and dashboard views. */
export default function ScoreHero({
  homeName,
  awayName,
  homeGoals,
  awayGoals,
  date,
  location,
  half,
  children,
  live,
}: Props) {
  const winner =
    homeGoals === awayGoals ? null : homeGoals > awayGoals ? 'home' : 'away'
  return (
    <section
      className="hero"
      aria-label={`Stand ${homeName} ${homeGoals} - ${awayGoals} ${awayName}`}
    >
      {live && <span className="hero-live">● Live</span>}
      <div className="hero-grid">
        <div className="hero-team" data-win={winner === 'home'}>
          <span className="hero-badge" aria-hidden>
            {homeName.slice(0, 2).toUpperCase()}
          </span>
          <span className="hero-name">{homeName}</span>
        </div>
        <div className="hero-score" aria-hidden>
          <span data-win={winner === 'home'}>{homeGoals}</span>
          <span className="hero-dash">:</span>
          <span data-win={winner === 'away'}>{awayGoals}</span>
        </div>
        <div className="hero-team hero-team-away" data-win={winner === 'away'}>
          <span className="hero-badge" aria-hidden>
            {awayName.slice(0, 2).toUpperCase()}
          </span>
          <span className="hero-name">{awayName}</span>
        </div>
      </div>
      {(date || location || half) && (
        <p className="hero-meta">
          {date && formatDate(date)}
          {location && ` · ${location}`}
          {half && ` · Rust ${half.home} – ${half.away}`}
        </p>
      )}
      {children}
    </section>
  )
}
