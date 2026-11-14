import Court, { CourtLegend } from './Court'
import { heatByTeam, toCourtFrame } from '../lib/heat'
import { teamAttacksRight } from '../lib/court'
import { matchColors } from '../lib/teamColors'
import type { Action, Match } from '../types'

/**
 * Both teams on one court, each on its own half: the team that attacks right
 * is drawn at the right goal, the other at the left goal (HVM switches sides
 * with home/away). Team name along the goal, team colour in the heat (light =
 * few, dark = many), with a small legend.
 */
export default function TeamHeat({
  match,
  teamName,
  actions,
  view = 'heat',
  label,
}: {
  match: Match
  teamName: (id: string) => string
  /** Actions that carry a court position. */
  actions: (Action & { x: number; y: number })[]
  view?: 'heat' | 'dots'
  label: string
}) {
  const colors = matchColors(match)
  const colorOf = (id: string) => (id === match.homeTeamId ? colors.home : colors.away)
  const teams = heatByTeam(actions, match)

  const dots =
    view === 'dots'
      ? actions.map((a) => ({
          ...toCourtFrame({ x: a.x, y: a.y }, teamAttacksRight(match, a.teamId)),
          type: a.type,
        }))
      : undefined

  return (
    <div className="space-y-2">
      <Court
        label={label}
        heatLayers={view === 'heat' ? teams.map((t) => ({ grid: t.grid, color: colorOf(t.teamId) })) : undefined}
        dots={dots}
        goalLabels={teams.map((t) => ({
          side: t.attacksRight ? 'r' : 'l',
          text: teamName(t.teamId),
          color: colorOf(t.teamId),
        }))}
      />
      {view === 'heat' ? (
        <ul className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-slate-600" aria-label="Legenda">
          {teams.map((t) => (
            <li key={t.teamId} className="flex items-center gap-2">
              <span className="font-semibold text-slate-800">{teamName(t.teamId)}</span>
              <span>weinig</span>
              <span
                aria-hidden
                className="heat-legend-bar"
                style={{ background: `linear-gradient(to right, ${colorOf(t.teamId)}1a, ${colorOf(t.teamId)})` }}
              />
              <span>veel</span>
            </li>
          ))}
        </ul>
      ) : (
        <CourtLegend types={[...new Set(actions.map((a) => a.type))]} />
      )}
    </div>
  )
}
