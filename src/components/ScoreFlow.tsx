import type { TimelinePoint } from '../lib/analysis'

const W = 720
const H = 240
const PAD = { l: 32, r: 12, t: 14, b: 26 }

/** Step chart of both teams' running score over the match clock. */
export default function ScoreFlow({
  points,
  homeName,
  awayName,
  /** Clock times (ms) of period boundaries, drawn as dashed lines. */
  boundaries = [],
}: {
  points: TimelinePoint[]
  homeName: string
  awayName: string
  boundaries?: number[]
}) {
  const last = points[points.length - 1]
  const maxT = Math.max(
    ...points.map((p) => p.t),
    ...boundaries,
    60_000,
  )
  const maxS = Math.max(last.home, last.away, 5)
  const x = (t: number) => PAD.l + (t / maxT) * (W - PAD.l - PAD.r)
  const y = (s: number) => H - PAD.b - (s / maxS) * (H - PAD.t - PAD.b)

  const path = (key: 'home' | 'away') => {
    let d = `M ${x(0)} ${y(0)}`
    let prev = 0
    for (const p of points.slice(1)) {
      d += ` L ${x(p.t)} ${y(prev)} L ${x(p.t)} ${y(p[key])}`
      prev = p[key]
    }
    // Extend to the final clock time.
    d += ` L ${x(maxT)} ${y(prev)}`
    return d
  }

  const yTicks = Array.from(
    { length: Math.floor(maxS / 5) + 1 },
    (_, i) => i * 5,
  )
  const minutes = Math.round(maxT / 60_000)
  const xTicks = Array.from(
    { length: Math.floor(minutes / 10) + 1 },
    (_, i) => i * 10,
  ).filter((m) => m * 60_000 <= maxT)

  return (
    <figure className="m-0">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Scoreverloop: ${homeName} ${last.home}, ${awayName} ${last.away}`}
        className="w-full"
      >
        {yTicks.map((s) => (
          <g key={s}>
            <line
              x1={PAD.l}
              x2={W - PAD.r}
              y1={y(s)}
              y2={y(s)}
              stroke="var(--line)"
            />
            <text x={PAD.l - 6} y={y(s) + 4} textAnchor="end" fontSize="11" fill="var(--muted)">
              {s}
            </text>
          </g>
        ))}
        {xTicks.map((m) => (
          <text
            key={m}
            x={x(m * 60_000)}
            y={H - 8}
            textAnchor="middle"
            fontSize="11"
            fill="var(--muted)"
          >
            {m}'
          </text>
        ))}
        {boundaries.map((b) => (
          <line
            key={b}
            x1={x(b)}
            x2={x(b)}
            y1={PAD.t}
            y2={H - PAD.b}
            stroke="var(--muted)"
            strokeDasharray="4 4"
          />
        ))}
        <path d={path('away')} fill="none" stroke="var(--away)" strokeWidth="2.5" strokeLinejoin="round" />
        <path d={path('home')} fill="none" stroke="var(--brand)" strokeWidth="2.5" strokeLinejoin="round" />
      </svg>
      <figcaption className="mt-1 flex flex-wrap gap-4 text-sm text-slate-600">
        <span className="flex items-center gap-1.5">
          <i className="legend-dot" style={{ background: 'var(--brand)' }} />
          {homeName} ({last.home})
        </span>
        <span className="flex items-center gap-1.5">
          <i className="legend-dot" style={{ background: 'var(--away)' }} />
          {awayName} ({last.away})
        </span>
      </figcaption>
    </figure>
  )
}
