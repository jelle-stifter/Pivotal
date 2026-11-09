import type { Action, PositionCode } from '../types'
import type { Point } from './court'

export const POSITIONS: { code: PositionCode; label: string }[] = [
  { code: 'LH', label: 'Links Hoek' },
  { code: 'RH', label: 'Rechts Hoek' },
  { code: 'LO', label: 'Links opbouw' },
  { code: 'RO', label: 'Rechts opbouw' },
  { code: 'M', label: 'Midden' },
  { code: 'C', label: 'Cirkel' },
  { code: 'K', label: 'Keeper' },
  { code: 'CC', label: '2e Cirkel' },
  { code: 'Br', label: 'Break' },
  { code: 'P', label: 'Penalty 7 meter' },
]

export function positionLabel(code: PositionCode | undefined): string {
  return POSITIONS.find((p) => p.code === code)?.label ?? ''
}

/**
 * A representative spot per position code, in the stored court frame
 * (x=1 opponent goal line, y=0 the acting team's left). A goal logged with a
 * code gets this point so the heatmaps keep working without clicking the court.
 */
export const POSITION_POINT: Record<PositionCode, Point> = {
  LH: { x: 0.93, y: 0.08 },
  RH: { x: 0.93, y: 0.92 },
  LO: { x: 0.77, y: 0.25 },
  RO: { x: 0.77, y: 0.75 },
  M: { x: 0.75, y: 0.5 },
  C: { x: 0.86, y: 0.45 },
  CC: { x: 0.86, y: 0.58 },
  K: { x: 0.25, y: 0.5 },
  Br: { x: 0.9, y: 0.5 },
  P: { x: 0.825, y: 0.5 },
}

/** The position that most of these goals came from (not the playing position). */
export function bestPosition(
  actions: Pick<Action, 'type' | 'position'>[],
): PositionCode | undefined {
  const count = new Map<PositionCode, number>()
  for (const a of actions) {
    if ((a.type !== 'goal' && a.type !== 'penalty_goal') || !a.position) continue
    count.set(a.position, (count.get(a.position) ?? 0) + 1)
  }
  let best: PositionCode | undefined
  let n = 0
  for (const [code, c] of count) {
    if (c > n) {
      best = code
      n = c
    }
  }
  return best
}

/** Goals per position code, most goals first. */
export function goalsPerPosition(
  actions: Pick<Action, 'type' | 'position'>[],
): { code: PositionCode; goals: number }[] {
  const count = new Map<PositionCode, number>()
  for (const a of actions) {
    if ((a.type !== 'goal' && a.type !== 'penalty_goal') || !a.position) continue
    count.set(a.position, (count.get(a.position) ?? 0) + 1)
  }
  return [...count].map(([code, goals]) => ({ code, goals })).sort((a, b) => b.goals - a.goals)
}
