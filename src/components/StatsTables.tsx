import { ACTION_META } from '../lib/actions'
import {
  formatPercentage,
  shotPercentage,
  sumTotals,
  totalGoals,
  type GoalkeeperStats,
  type Totals,
} from '../lib/stats'
import type { ActionType } from '../types'

export interface TotalsRow {
  key: string
  label: string
  sub?: string
  totals: Totals
  /** Matches played; only used when `showMatches` is set (season view). */
  matches?: number
}

export function TotalsTable({
  rows,
  labelHeader,
  types,
  showTeam = false,
  showTotal = false,
  showMatches = false,
}: {
  rows: TotalsRow[]
  labelHeader: string
  types: ActionType[]
  showTeam?: boolean
  showTotal?: boolean
  showMatches?: boolean
}) {
  if (rows.length === 0)
    return <p className="py-4 text-slate-500">Geen gegevens.</p>

  const perMatch = (t: Totals, matches?: number) =>
    matches ? (totalGoals(t) / matches).toLocaleString('nl-NL', { maximumFractionDigits: 1 }) : ''

  const cells = (t: Totals, matches?: number) => (
    <>
      {showMatches && (
        <td className="text-right tabular-nums">{matches ?? ''}</td>
      )}
      {types.map((type) => (
        <td key={type} className="text-right tabular-nums">
          {t[type]}
        </td>
      ))}
      <td className="text-right font-semibold tabular-nums">{totalGoals(t)}</td>
      <td className="text-right font-semibold tabular-nums">
        {formatPercentage(shotPercentage(t))}
      </td>
      {showMatches && (
        <td className="text-right tabular-nums">{perMatch(t, matches)}</td>
      )}
    </>
  )

  return (
    <div className="overflow-x-auto">
      <table className="table stats-table">
        <thead>
          <tr>
            <th>{labelHeader}</th>
            {showTeam && <th>Team</th>}
            {showMatches && <th className="text-right">Wedstr.</th>}
            {types.map((t) => (
              <th key={t} className="text-right">
                {ACTION_META[t].label}
              </th>
            ))}
            <th className="text-right">Goals tot.</th>
            <th className="text-right">Schot%</th>
            {showMatches && <th className="text-right">Goals/wedstr.</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <td className="font-semibold">{r.label}</td>
              {showTeam && <td>{r.sub}</td>}
              {cells(r.totals, r.matches)}
            </tr>
          ))}
        </tbody>
        {showTotal && rows.length > 1 && (
          <tfoot>
            <tr className="total-row">
              <td className="font-bold">Totaal</td>
              {showTeam && <td />}
              {cells(sumTotals(rows.map((r) => r.totals)))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}

export interface KeeperRow {
  key: string
  label: string
  team: string
  stats: GoalkeeperStats
}

export function KeeperTable({ rows }: { rows: KeeperRow[] }) {
  if (rows.length === 0)
    return (
      <p className="py-4 text-slate-500">
        Geen keepers. Vink een speler aan als keeper onder Teams.
      </p>
    )
  return (
    <div className="overflow-x-auto">
      <table className="table stats-table">
        <thead>
          <tr>
            <th>Keeper</th>
            <th>Team</th>
            <th className="text-right">Stops</th>
            <th className="text-right">Tegengoals</th>
            <th className="text-right">Stop%</th>
            <th className="text-right">7m gestopt</th>
            <th className="text-right">7m tegen</th>
            <th className="text-right">7m stop%</th>
            <th className="text-right">Totaal stop%</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ key, label, team, stats: g }) => (
            <tr key={key}>
              <td className="font-semibold">{label}</td>
              <td>{team}</td>
              <td className="text-right tabular-nums">{g.saves}</td>
              <td className="text-right tabular-nums">{g.goalsConceded}</td>
              <td className="text-right font-semibold tabular-nums">
                {formatPercentage(g.savePercentage)}
              </td>
              <td className="text-right tabular-nums">{g.penaltySaves}</td>
              <td className="text-right tabular-nums">
                {g.penaltyGoalsConceded}
              </td>
              <td className="text-right font-semibold tabular-nums">
                {formatPercentage(g.penaltySavePercentage)}
              </td>
              <td className="text-right font-semibold tabular-nums">
                {formatPercentage(g.totalSavePercentage)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
