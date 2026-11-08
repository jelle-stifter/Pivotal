import type { MouseEvent } from 'react'
import { ACTION_COLOR, ACTION_META } from '../lib/actions'
import type { Point } from '../lib/court'
import { ACTION_TYPES, type ActionType } from '../types'

// Court in metres (40 x 20) with a 1 m margin so the goals stay visible.
const M = 1
const W = 40
const H = 20
const VIEW = `${-M} ${-M} ${W + 2 * M} ${H + 2 * M}`

export interface CourtDot extends Point {
  type: ActionType
}

interface Props {
  /** Click-to-pick: receives raw coordinates 0..1 in the displayed court. */
  onPick?: (p: Point) => void
  /** Marker for a not-yet-saved position (same frame as the display). */
  pending?: Point | null
  /** Dots, drawn in the displayed frame, coloured by action type. */
  dots?: CourtDot[]
  /** Heat layer: grid[row][col] in 0..1. */
  heat?: number[][] | null
  label: string
  className?: string
}

// Free-throw (9 m) and goal-area (6 m) lines: straight 3 m piece between two
// quarter circles around the goal posts (y = 8.5 and 11.5).
const area = (r: number, side: 'l' | 'r') =>
  side === 'l'
    ? `M0 ${8.5 - r}A${r} ${r} 0 0 1 ${r} 8.5L${r} 11.5A${r} ${r} 0 0 1 0 ${11.5 + r}`
    : `M${W} ${8.5 - r}A${r} ${r} 0 0 0 ${W - r} 8.5L${W - r} 11.5A${r} ${r} 0 0 0 ${W} ${11.5 + r}`

function heatColor(v: number): string {
  // yellow (low) -> red (high)
  return `hsl(${Math.round(55 - 55 * v)} 95% 50%)`
}

export default function Court({
  onPick,
  pending,
  dots,
  heat,
  label,
  className,
}: Props) {
  function handleClick(e: MouseEvent<SVGSVGElement>) {
    if (!onPick) return
    const rect = e.currentTarget.getBoundingClientRect()
    const vx = ((e.clientX - rect.left) / rect.width) * (W + 2 * M) - M
    const vy = ((e.clientY - rect.top) / rect.height) * (H + 2 * M) - M
    onPick({
      x: Math.min(1, Math.max(0, vx / W)),
      y: Math.min(1, Math.max(0, vy / H)),
    })
  }

  return (
    <svg
      viewBox={VIEW}
      role="img"
      aria-label={label}
      className={className}
      style={{
        width: '100%',
        aspectRatio: `${W + 2 * M} / ${H + 2 * M}`,
        cursor: onPick ? 'crosshair' : 'default',
        display: 'block',
      }}
      // Keep keyboard focus where it is: the hotkeys must keep working.
      onMouseDown={(e) => e.preventDefault()}
      onClick={handleClick}
    >
      <defs>
        <clipPath id="court-clip">
          <rect x="0" y="0" width={W} height={H} />
        </clipPath>
      </defs>

      <rect x="0" y="0" width={W} height={H} fill="#e0f2fe" />

      {heat && (
        <g clipPath="url(#court-clip)" pointerEvents="none">
          {heat.flatMap((row, r) =>
            row.map((v, c) =>
              v < 0.04 ? null : (
                <rect
                  key={`${r}-${c}`}
                  x={(c * W) / row.length}
                  y={(r * H) / heat.length}
                  width={W / row.length + 0.02}
                  height={H / heat.length + 0.02}
                  fill={heatColor(v)}
                  opacity={Math.min(0.9, 0.15 + 0.75 * v)}
                />
              ),
            ),
          )}
        </g>
      )}

      <g
        fill="none"
        stroke="#1e3a8a"
        strokeWidth="0.15"
        pointerEvents="none"
      >
        <rect x="0" y="0" width={W} height={H} />
        <line x1={W / 2} y1="0" x2={W / 2} y2={H} />
        {/* goals */}
        <rect x={-0.9} y="8.5" width="0.9" height="3" strokeWidth="0.25" />
        <rect x={W} y="8.5" width="0.9" height="3" strokeWidth="0.25" />
        {/* 6 m goal areas */}
        <path d={area(6, 'l')} />
        <path d={area(6, 'r')} />
        {/* 9 m free-throw lines (dashed, clipped to the court) */}
        <g clipPath="url(#court-clip)" strokeDasharray="0.6 0.5">
          <path d={area(9, 'l')} />
          <path d={area(9, 'r')} />
        </g>
        {/* 7 m penalty marks */}
        <line x1="7" y1="9.5" x2="7" y2="10.5" />
        <line x1={W - 7} y1="9.5" x2={W - 7} y2="10.5" />
      </g>

      {dots?.map((d, i) => (
        <circle
          key={i}
          cx={d.x * W}
          cy={d.y * H}
          r="0.5"
          fill={ACTION_COLOR[d.type]}
          stroke="#fff"
          strokeWidth="0.12"
          opacity="0.9"
          pointerEvents="none"
        />
      ))}

      {pending && (
        <g pointerEvents="none">
          <circle
            cx={pending.x * W}
            cy={pending.y * H}
            r="0.8"
            fill="none"
            stroke="#0f172a"
            strokeWidth="0.2"
          />
          <circle cx={pending.x * W} cy={pending.y * H} r="0.25" fill="#0f172a" />
        </g>
      )}
    </svg>
  )
}

export function CourtLegend({ types = ACTION_TYPES }: { types?: ActionType[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm" aria-label="Legenda">
      {types.map((t) => (
        <li key={t} className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="inline-block h-3 w-3 rounded-full"
            style={{ background: ACTION_COLOR[t] }}
          />
          {ACTION_META[t].label}
        </li>
      ))}
    </ul>
  )
}
