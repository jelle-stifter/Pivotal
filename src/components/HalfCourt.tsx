import { useRef, type PointerEvent } from 'react'
import { cellGoalPoint } from '../lib/shots'

type P = { x: number; y: number }

// Attacking half in metres: x 20..40, with a 1 m margin so the goal stays visible.
const W = 40
const H = 20
// The half is drawn turned 90 degrees (goal at the top): (x, y) -> (y, -x).
const VB = '-1 -41 22 22'
const VW = 22
const VH = 22
const ROT = 'rotate(-90)'

const area = (r: number) =>
  `M${W} ${8.5 - r}A${r} ${r} 0 0 0 ${W - r} 8.5L${W - r} 11.5A${r} ${r} 0 0 0 ${W} ${11.5 + r}`

export type HalfMode = 'shooter' | 'bounce' | 'draw' | null // schietpositie, stuit, baltraject

/**
 * The half of the court the team attacks, goal at the top (same normalized
 * frame as the stored positions: x = 1 is the goal line). Shows the shooting
 * position, the bounce and the ball path; can be clicked / drawn on.
 */
export default function HalfCourt({
  shooter,
  bounce,
  goalCell,
  path,
  mode = null,
  onShooter,
  onBounce,
  onPath,
  label,
}: {
  shooter?: P | null
  bounce?: P | null
  goalCell?: number
  path?: P[]
  mode?: HalfMode
  onShooter?: (p: P) => void
  onBounce?: (p: P) => void
  onPath?: (p: P[]) => void
  label: string
}) {
  const svgRef = useRef<SVGSVGElement>(null)
  const drawing = useRef<P[] | null>(null)

  const toNorm = (e: PointerEvent<SVGSVGElement>): P => {
    const r = svgRef.current!.getBoundingClientRect()
    const sx = ((e.clientX - r.left) / r.width) * VW - 1 // = y in metres
    const sy = ((e.clientY - r.top) / r.height) * VH - 41 // = -x in metres
    return {
      x: Math.min(1, Math.max(0.5, -sy / W)),
      y: Math.min(1, Math.max(0, sx / H)),
    }
  }
  const m = (p: P) => ({ cx: p.x * W, cy: p.y * H })

  function down(e: PointerEvent<SVGSVGElement>) {
    if (!mode) return
    const p = toNorm(e)
    if (mode === 'shooter') onShooter?.(p)
    else if (mode === 'bounce') onBounce?.(p)
    else if (mode === 'draw') {
      e.currentTarget.setPointerCapture(e.pointerId)
      drawing.current = [p]
      onPath?.([p])
    }
  }
  function move(e: PointerEvent<SVGSVGElement>) {
    if (mode !== 'draw' || !drawing.current) return
    drawing.current = [...drawing.current, toNorm(e)]
    onPath?.(drawing.current)
  }
  function up() {
    drawing.current = null
  }

  const end = goalCell !== undefined ? cellGoalPoint(goalCell) : null
  // Ball route: shooter -> bounce -> goal cell (or straight to the goal without a bounce).
  const route = [shooter, bounce, end].filter(Boolean) as P[]
  const pts = (list: P[]) => list.map((p) => `${p.x * W},${p.y * H}`).join(' ')

  return (
    <svg
      ref={svgRef}
      viewBox={VB}
      role="img"
      aria-label={label}
      style={{
        width: '100%',
        aspectRatio: `${VW} / ${VH}`,
        display: 'block',
        touchAction: mode ? 'none' : 'auto',
        cursor: mode ? 'crosshair' : 'default',
        background: '#f3f4f6',
      }}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
    >
      <g transform={ROT}>
      <g fill="none" stroke="#4b5563" strokeWidth="0.15" pointerEvents="none">
        <rect x="20" y="0" width="20" height="20" />
        <rect x={W} y="8.5" width="0.9" height="3" strokeWidth="0.25" />
        <path d={area(6)} />
        <path d={area(9)} strokeDasharray="0.6 0.5" />
        <line x1={W - 7} y1="9.5" x2={W - 7} y2="10.5" />
      </g>

      {route.length > 1 && (
        <polyline
          points={pts(route)}
          fill="none"
          stroke="#111827"
          strokeWidth="0.25"
          strokeLinejoin="round"
          pointerEvents="none"
        />
      )}
      {path && path.length > 1 && (
        <polyline
          points={pts(path)}
          fill="none"
          stroke="#6b7280"
          strokeWidth="0.3"
          strokeDasharray="0.5 0.4"
          strokeLinejoin="round"
          strokeLinecap="round"
          pointerEvents="none"
        />
      )}
      {end && <circle {...m(end)} r="0.4" fill="#111827" pointerEvents="none" />}
      {bounce && (
        <circle {...m(bounce)} r="0.55" fill="#fff" stroke="#111827" strokeWidth="0.2" pointerEvents="none" />
      )}
      {shooter && (
        <circle {...m(shooter)} r="0.6" fill="#111827" stroke="#fff" strokeWidth="0.15" pointerEvents="none" />
      )}
      </g>
    </svg>
  )
}

/** Just the bounce points of many shots (keeper overview). */
export function BounceMap({ points, label }: { points: P[]; label: string }) {
  return (
    <svg
      viewBox={VB}
      role="img"
      aria-label={label}
      style={{ width: '100%', aspectRatio: `${VW} / ${VH}`, display: 'block', background: '#f3f4f6' }}
    >
      <g transform={ROT}>
        <g fill="none" stroke="#4b5563" strokeWidth="0.15">
          <rect x="20" y="0" width="20" height="20" />
          <rect x={W} y="8.5" width="0.9" height="3" strokeWidth="0.25" />
          <path d={area(6)} />
          <path d={area(9)} strokeDasharray="0.6 0.5" />
        </g>
        {points.map((p, i) => (
          <circle key={i} cx={p.x * W} cy={p.y * H} r="0.5" fill="#111827" opacity="0.6" />
        ))}
      </g>
    </svg>
  )
}
