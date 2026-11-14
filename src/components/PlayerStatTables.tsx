import { useState } from 'react'
import {
  fieldPlayerCells,
  keeperCells,
  showCell,
  type Cell,
} from '../lib/statTables'
import type { GoalkeeperStats, Totals } from '../lib/stats'

/** Highlight state shared by both tables: click a row (name or value) to mark it, click again to clear. */
function useRowSelect() {
  const [selected, setSelected] = useState<string | null>(null)
  const toggle = (key: string) => setSelected((cur) => (cur === key ? null : key))
  return { selected, toggle }
}

const num = 'text-right tabular-nums'

export interface FieldRow {
  key: string
  label: string
  totals: Totals
}

export interface FieldGroup {
  key: string
  /** Team name above the rows; leave out when there is one group. */
  title?: string
  rows: FieldRow[]
}

/** Table 1: field players (16 columns). Empty cells instead of zeros. */
export function FieldPlayersTable({ groups, label = 'Veldspelers' }: { groups: FieldGroup[]; label?: string }) {
  const { selected, toggle } = useRowSelect()
  if (groups.every((g) => g.rows.length === 0))
    return <p className="py-4 text-slate-500">Geen gegevens.</p>

  const header = [
    'Totaal doelpunten',
    'Doelpunten',
    'Missers',
    '7m-doelpunt',
    '7m-stop',
    '7m niet op doel',
    'Totaal schoten op doel',
    'Schotpercentage',
    'Assists',
    '7m gekregen',
    'Fouten',
    'Gele kaart',
    '2 minuten',
    'Rode kaart',
    'Blauwe kaart',
  ]

  return (
    <div className="overflow-x-auto">
      <table className="table stats-table stat-grid" aria-label={label}>
        <thead>
          <tr>
            <th>Naam</th>
            {header.map((h) => (
              <th key={h} className={h === 'Schotpercentage' ? 'text-right stat-pct' : 'text-right'}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => (
            <GroupRows key={g.key} group={g} columns={header.length + 1} selected={selected} toggle={toggle} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function GroupRows({
  group,
  columns,
  selected,
  toggle,
}: {
  group: FieldGroup
  columns: number
  selected: string | null
  toggle: (key: string) => void
}) {
  return (
    <>
      {group.title && group.rows.length > 0 && (
        <tr className="stat-group">
          <th colSpan={columns} className="text-left">
            {group.title}
          </th>
        </tr>
      )}
      {group.rows.map((r) => {
        const c = fieldPlayerCells(r.totals)
        const cells: [Cell, string?][] = [
          [c.totalGoals],
          [c.goals],
          [c.misses],
          [c.penaltyGoals],
          [c.penaltySaved],
          [c.penaltyOff],
          [c.totalShots],
          [c.shotPct, '%'],
          [c.assists],
          [c.penaltyWon],
          [c.fouls],
          [c.yellow],
          [c.suspension],
          [c.red],
          [c.blue],
        ]
        return (
          <SelectableRow key={r.key} id={r.key} label={r.label} selected={selected === r.key} toggle={toggle}>
            {cells.map(([cell, suffix], i) => (
              <td key={i} className={suffix ? `${num} stat-pct` : num}>
                {showCell(cell, suffix)}
              </td>
            ))}
          </SelectableRow>
        )
      })}
    </>
  )
}

function SelectableRow({
  id,
  label,
  selected,
  toggle,
  children,
}: {
  id: string
  label: string
  selected: boolean
  toggle: (key: string) => void
  children: React.ReactNode
}) {
  return (
    <tr className={selected ? 'stat-row-selected' : undefined} onClick={() => toggle(id)}>
      <td className="font-semibold">
        <button
          type="button"
          className="stat-name-btn"
          aria-pressed={selected}
          onClick={(e) => {
            e.stopPropagation()
            toggle(id)
          }}
        >
          {label}
        </button>
      </td>
      {children}
    </tr>
  )
}

export interface KeeperRowData {
  key: string
  label: string
  stats: GoalkeeperStats
}

/** Table 2: keepers (8 columns). Empty cells instead of zeros. */
export function KeepersTable({ rows, label = 'Keepers' }: { rows: KeeperRowData[]; label?: string }) {
  const { selected, toggle } = useRowSelect()
  if (rows.length === 0)
    return <p className="py-4 text-slate-500">Geen keepers. Vink een speler aan als keeper onder Teams.</p>

  const header = [
    'Totaal stops',
    'Stops',
    'Doelpunten tegen',
    '7m-stop',
    '7m-doelpunt tegen',
    'Totaal schoten op doel',
    'Schotpercentage',
  ]
  return (
    <div className="overflow-x-auto">
      <table className="table stats-table stat-grid" aria-label={label}>
        <thead>
          <tr>
            <th>Naam</th>
            {header.map((h) => (
              <th key={h} className={h === 'Schotpercentage' ? 'text-right stat-pct' : 'text-right'}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const c = keeperCells(r.stats)
            const cells: [Cell, string?][] = [
              [c.totalSaves],
              [c.saves],
              [c.goalsAgainst],
              [c.penaltySaved],
              [c.penaltyGoalsAgainst],
              [c.totalShots],
              [c.savePct, '%'],
            ]
            return (
              <SelectableRow key={r.key} id={r.key} label={r.label} selected={selected === r.key} toggle={toggle}>
                {cells.map(([cell, suffix], i) => (
                  <td key={i} className={suffix ? `${num} stat-pct` : num}>
                    {showCell(cell, suffix)}
                  </td>
                ))}
              </SelectableRow>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
