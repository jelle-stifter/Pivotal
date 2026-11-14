import type { GoalkeeperStats, Totals } from './stats'

/**
 * A cell is a number, or null = leave the cell empty. We never show "0":
 * a player without data in a column gets an empty cell. This also holds for
 * the calculated columns (sums and percentages).
 */
export type Cell = number | null

const n = (v: number): Cell => (v > 0 ? v : null)

export interface FieldPlayerCells {
  totalGoals: Cell
  goals: Cell
  misses: Cell
  penaltyGoals: Cell
  penaltySaved: Cell
  penaltyOff: Cell
  totalShots: Cell
  /** Whole percent (0..100). */
  shotPct: Cell
  assists: Cell
  penaltyWon: Cell
  fouls: Cell
  yellow: Cell
  suspension: Cell
  red: Cell
  blue: Cell
}

/**
 * Columns of table 1 (field players), from the action totals of one player.
 *
 * Formulas (assumptions of the coach, see the report):
 *  - Totaal doelpunten = doelpunten + 7m-doelpunten
 *  - Totaal schoten op doel = doelpunten + missers + 7m-doelpunt + 7m-stop + 7m niet op doel
 *    ("Niet op doel" of een veldschot telt dus niet mee)
 *  - Schotpercentage = totaal doelpunten / totaal schoten op doel x 100, op hele procenten
 *  - Fouten = onderschepping + passfout + technische fout
 */
export function fieldPlayerCells(t: Totals): FieldPlayerCells {
  const totalGoals = t.goal + t.penalty_goal
  const totalShots = t.goal + t.shot + t.penalty_goal + t.penalty_saved + t.penalty_miss
  return {
    totalGoals: n(totalGoals),
    goals: n(t.goal),
    misses: n(t.shot),
    penaltyGoals: n(t.penalty_goal),
    penaltySaved: n(t.penalty_saved),
    penaltyOff: n(t.penalty_miss),
    totalShots: n(totalShots),
    shotPct: totalShots > 0 ? Math.round((totalGoals / totalShots) * 100) : null,
    assists: n(t.assist),
    penaltyWon: n(t.penalty_won),
    fouls: n(t.interception + t.bad_pass + t.technical_foul),
    yellow: n(t.yellow_card),
    suspension: n(t.suspension),
    red: n(t.red_card),
    blue: n(t.blue_card),
  }
}

/** True when this player has anything to show in table 1. */
export function hasFieldData(t: Totals): boolean {
  return Object.values(fieldPlayerCells(t)).some((c) => c !== null)
}

export interface KeeperCells {
  totalSaves: Cell
  saves: Cell
  goalsAgainst: Cell
  penaltySaved: Cell
  penaltyGoalsAgainst: Cell
  totalShots: Cell
  /** Whole percent (0..100). */
  savePct: Cell
}

/**
 * Columns of table 2 (keepers).
 *  - Totaal stops = stops + 7m-stops
 *  - Totaal schoten op doel = stops + doelpunten tegen + 7m-stop + 7m-doelpunt tegen
 *  - Schotpercentage = totaal stops / totaal schoten op doel x 100 (reddingspercentage)
 */
export function keeperCells(g: GoalkeeperStats): KeeperCells {
  const totalSaves = g.saves + g.penaltySaves
  const totalShots = g.saves + g.goalsConceded + g.penaltySaves + g.penaltyGoalsConceded
  return {
    totalSaves: n(totalSaves),
    saves: n(g.saves),
    goalsAgainst: n(g.goalsConceded),
    penaltySaved: n(g.penaltySaves),
    penaltyGoalsAgainst: n(g.penaltyGoalsConceded),
    totalShots: n(totalShots),
    savePct: totalShots > 0 ? Math.round((totalSaves / totalShots) * 100) : null,
  }
}

export const showCell = (c: Cell, suffix = ''): string => (c === null ? '' : `${c}${suffix}`)
