import type { CompareRow } from '../lib/analysis'

/** Mirrored bars per metric: home grows from the left, away from the right. */
export default function CompareBars({
  rows,
  homeName,
  awayName,
}: {
  rows: CompareRow[]
  homeName: string
  awayName: string
}) {
  if (rows.length === 0)
    return (
      <p className="py-6 text-center text-slate-500">
        Nog geen acties om te vergelijken.
      </p>
    )
  return (
    <div className="compare" role="table" aria-label="Teamvergelijking">
      <div className="compare-head" role="row">
        <span className="font-bold">{homeName}</span>
        <span className="font-bold text-right">{awayName}</span>
      </div>
      {rows.map((r) => {
        const max = Math.max(r.home, r.away, 1)
        const better =
          r.home === r.away
            ? null
            : (r.home > r.away) !== !!r.lowerIsBetter
              ? 'home'
              : 'away'
        return (
          <div key={r.key} className="compare-row" role="row">
            <div className="compare-label">{r.label}</div>
            <div className="compare-line">
              <span
                className="compare-num"
                data-best={better === 'home'}
                role="cell"
              >
                {r.homeText ?? r.home}
              </span>
              <div className="compare-track compare-track-home">
                <div
                  className="compare-bar"
                  data-best={better === 'home'}
                  style={{ width: `${(r.home / max) * 100}%` }}
                />
              </div>
              <div className="compare-track compare-track-away">
                <div
                  className="compare-bar compare-bar-away"
                  data-best={better === 'away'}
                  style={{ width: `${(r.away / max) * 100}%` }}
                />
              </div>
              <span
                className="compare-num text-right"
                data-best={better === 'away'}
                role="cell"
              >
                {r.awayText ?? r.away}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
