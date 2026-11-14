import { CELL_NAMES } from '../lib/shots'

/**
 * The goal as a 3x3 grid, seen from the shooter (left = the shooter's left).
 * Click a cell to choose where the ball ended up; or pass `counts` for an overview.
 */
export default function GoalGrid({
  value,
  onPick,
  counts,
  label,
}: {
  value?: number
  onPick?: (cell: number | undefined) => void
  /** Overview mode: text per cell (e.g. "3 / 5"). */
  counts?: { main: string; sub?: string; strength: number }[]
  label: string
}) {
  return (
    <div role="group" aria-label={label} className="mx-auto w-full max-w-[16rem]">
      <div className="grid grid-cols-3 gap-0 border-x-[6px] border-t-[6px] border-gray-700 bg-white">
        {Array.from({ length: 9 }, (_, i) => {
          const selected = value === i
          const c = counts?.[i]
          const shade = c ? Math.min(1, c.strength) * 0.55 : 0
          const common =
            'flex aspect-[4/3] min-h-0 flex-col items-center justify-center border border-gray-300 text-sm font-bold'
          if (!onPick)
            return (
              <div
                key={i}
                className={common}
                style={{ background: c ? `rgb(55 65 81 / ${shade})` : selected ? '#374151' : undefined,
                         color: selected || shade > 0.3 ? '#fff' : '#111827' }}
              >
                {c && <span>{c.main}</span>}
                {c?.sub && <span className="text-[0.65rem] font-normal opacity-80">{c.sub}</span>}
                {!c && selected && <span aria-hidden>●</span>}
              </div>
            )
          return (
            <button
              key={i}
              type="button"
              aria-pressed={selected}
              aria-label={CELL_NAMES[i]}
              onClick={() => onPick(selected ? undefined : i)}
              className={`${common} min-h-[44px] cursor-pointer hover:bg-gray-200`}
              style={{ background: selected ? '#374151' : undefined, color: selected ? '#fff' : undefined }}
            >
              {selected ? '●' : ''}
            </button>
          )
        })}
      </div>
    </div>
  )
}
