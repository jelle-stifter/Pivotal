import type { MatchFormat } from '../types'

export function periodLabel(format: MatchFormat, period: number): string {
  if (format === 2) return period === 1 ? '1e helft' : '2e helft'
  return `${period}e derde`
}

export function periodLabels(format: MatchFormat): string[] {
  return Array.from({ length: format }, (_, i) => periodLabel(format, i + 1))
}
