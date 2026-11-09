import type { Action, PositionCode } from '../types'
import { goalsPerPosition } from './positions'
import { emptyTotals, goalkeeperStats, playerTotals, type GoalkeeperStats, type Totals } from './stats'

export interface PlayerProfile {
  /** Matches in which this player shows up in at least one action. */
  matchIds: string[]
  totals: Totals
  goals: number
  penaltyGoals: number
  totalGoals: number
  /** Shots on the keeper: goals, saved shots and saved 7m. */
  shotsOnTarget: number
  /** Shots that missed the goal (including a 7m off target). */
  shotsOffTarget: number
  /** Goals / shots on target, null without shots. */
  shotPct: number | null
  assists: number
  blocks: number
  interceptions: number
  /** Ball losses: turnover, passing and technical errors. */
  turnovers: number
  /** Fouls: logged fouls plus fouls that caused a penalty. */
  fouls: number
  yellow: number
  suspensions: number
  red: number
  blue: number
  penalties: {
    taken: number
    scored: number
    saved: number
    offTarget: number
    won: number
    caused: number
  }
  goalsPerPosition: { code: PositionCode; goals: number }[]
  keeper: GoalkeeperStats
}

/** Everything that can be derived about one player from all logged actions. */
export function playerProfile(actions: Action[], playerId: string): PlayerProfile {
  const totals = playerTotals(actions).get(playerId) ?? emptyTotals()
  const own = actions.filter((a) => a.playerId === playerId)
  const matchIds = new Set<string>()
  for (const a of actions)
    if (
      a.playerId === playerId ||
      a.assistId === playerId ||
      a.fouledId === playerId ||
      a.foulerId === playerId ||
      a.goalkeeperId === playerId
    )
      matchIds.add(a.matchId)

  const caused = actions.filter((a) => a.foulerId === playerId).length
  const won = actions.filter((a) => a.fouledId === playerId).length
  const penaltyTypes = ['penalty_goal', 'penalty_miss', 'penalty_saved']
  const taken = own.filter((a) => penaltyTypes.includes(a.type))

  const shotsOnTarget = totals.goal + totals.penalty_goal + totals.shot + totals.penalty_saved
  const goals = totals.goal
  const penaltyGoals = totals.penalty_goal

  return {
    matchIds: [...matchIds],
    totals,
    goals,
    penaltyGoals,
    totalGoals: goals + penaltyGoals,
    shotsOnTarget,
    shotsOffTarget: totals.off_target + totals.penalty_miss,
    shotPct: shotsOnTarget === 0 ? null : (goals + penaltyGoals) / shotsOnTarget,
    assists: totals.assist,
    blocks: totals.block,
    interceptions: totals.interception,
    turnovers: totals.turnover + totals.bad_pass + totals.technical_foul,
    fouls: totals.foul + caused,
    yellow: totals.yellow_card,
    suspensions: totals.suspension,
    red: totals.red_card,
    blue: totals.blue_card,
    penalties: {
      taken: taken.length,
      scored: totals.penalty_goal,
      saved: totals.penalty_saved,
      offTarget: totals.penalty_miss,
      won: totals.penalty_won + won,
      caused,
    },
    goalsPerPosition: goalsPerPosition(own),
    keeper: goalkeeperStats(actions, [playerId])[0],
  }
}
