import type { Action, ActionType, PositionCode } from '../types'

/** What the live screen starts. `side` is seen from our own team (HVM). */
export type FlowSpec =
  | { kind: 'goal'; side: 'own' | 'opp' }
  | { kind: 'penalty'; side: 'own' | 'opp' }
  /** One player only: miss, off target, pass error, ... (or the opponent's off target). */
  | { kind: 'single'; side: 'own' | 'opp'; type: ActionType }
  /** The opponent's shot was stopped: pick our keeper. */
  | { kind: 'save' }
  /** Card or 2 minutes: team, then player or staff member. */
  | { kind: 'card'; type: ActionType }

export type StepKind =
  | 'ownPlayer'
  | 'oppPlayer'
  | 'ownKeeper'
  | 'position'
  | 'choice'
  | 'team'
  | 'person'

export interface Step {
  key: string
  title: string
  kind: StepKind
  options?: { value: string; label: string }[]
  /** May be skipped (stored as an empty answer). */
  optional?: boolean
  /** Person step: which team. */
  team?: 'own' | 'opp'
  /** Own players that are shown first (the coach's top 3 penalty takers). */
  quick?: boolean
  /** Do not offer this player (e.g. the scorer as assist giver). */
  excludeKey?: string
}

export type Answers = Record<string, string>

const OUTCOME = [
  { value: 'goal', label: 'Doelpunt' },
  { value: 'off', label: 'Niet op doel' },
  { value: 'stop', label: 'Stop' },
]
const OUTCOME2 = [
  { value: 'goal', label: 'Doelpunt' },
  { value: 'miss', label: 'Mis' },
  { value: 'off', label: 'Niet op doel' },
]

/** All steps that are known so far; later steps depend on earlier answers. */
export function stepsFor(spec: FlowSpec, a: Answers): Step[] {
  switch (spec.kind) {
    case 'goal':
      return spec.side === 'own'
        ? [
            { key: 'player', title: 'Wie scoorde?', kind: 'ownPlayer' },
            { key: 'position', title: 'Vanaf welke positie?', kind: 'position' },
            {
              key: 'assist',
              title: 'Wie gaf de assist?',
              kind: 'ownPlayer',
              optional: true,
              excludeKey: 'player',
            },
          ]
        : [
            { key: 'keeper', title: 'Welke keeper kreeg de bal binnen?', kind: 'ownKeeper' },
            { key: 'player', title: 'Welke tegenstander scoorde?', kind: 'oppPlayer' },
            { key: 'position', title: 'Vanaf welke positie?', kind: 'position' },
          ]
    case 'single':
      return [
        {
          key: 'player',
          title: spec.side === 'own' ? 'Welke speler?' : 'Welke tegenstander?',
          kind: spec.side === 'own' ? 'ownPlayer' : 'oppPlayer',
        },
      ]
    case 'save':
      return [{ key: 'keeper', title: 'Welke keeper stopte?', kind: 'ownKeeper' }]
    case 'card':
      return [
        { key: 'team', title: 'Welk team?', kind: 'team' },
        {
          key: 'person',
          title: 'Welke speler of staflid?',
          kind: 'person',
          team: a.team === 'opp' ? 'opp' : 'own',
        },
      ]
    case 'penalty': {
      const own = spec.side === 'own'
      const steps: Step[] = [
        {
          key: 'fouled',
          title: own ? 'Op welke eigen speler was de fout?' : 'Welke tegenstander onderging de fout?',
          kind: own ? 'ownPlayer' : 'oppPlayer',
        },
        {
          key: 'fouler',
          title: own ? 'Welke tegenstander maakte de fout?' : 'Welke eigen speler maakte de fout?',
          kind: own ? 'oppPlayer' : 'ownPlayer',
        },
        {
          key: 'taker',
          title: 'Wie nam de penalty?',
          kind: own ? 'ownPlayer' : 'oppPlayer',
          quick: own,
        },
        { key: 'outcome', title: 'Uitkomst', kind: 'choice', options: OUTCOME },
      ]
      if (a.outcome === 'stop') {
        if (!own) steps.push({ key: 'keeper', title: 'Welke keeper stopte?', kind: 'ownKeeper' })
        steps.push({
          key: 'after',
          title: 'Wat gebeurde er na de stop?',
          kind: 'choice',
          options: [
            { value: 'rebound', label: 'Rebound' },
            { value: 'ball', label: own ? 'Bal naar de tegenstander' : 'Bal naar ons' },
          ],
        })
        if (a.after === 'rebound') {
          steps.push({
            key: 'shooter',
            title: 'Wie nam de rebound?',
            kind: own ? 'ownPlayer' : 'oppPlayer',
          })
          steps.push({ key: 'outcome2', title: 'Uitkomst rebound', kind: 'choice', options: OUTCOME2 })
          if (a.outcome2 === 'goal')
            steps.push({ key: 'position2', title: 'Vanaf welke positie?', kind: 'position' })
        }
      }
      return steps
    }
  }
}

export function nextStep(spec: FlowSpec, a: Answers): Step | null {
  return stepsFor(spec, a).find((s) => !(s.key in a)) ?? null
}

/** The key to remove when the user goes one step back. */
export function lastAnsweredKey(spec: FlowSpec, a: Answers): string | null {
  const answered = stepsFor(spec, a).filter((s) => s.key in a)
  return answered.length === 0 ? null : answered[answered.length - 1].key
}

export interface FlowContext {
  matchId: string
  ownTeamId: string
  oppTeamId: string
  /** The own keeper on court (default for goals against). */
  ownGoalkeeperId?: string
  groupId: string
}

export type ActionDraft = Pick<Action, 'matchId' | 'teamId' | 'playerId' | 'type'> &
  Partial<
    Pick<
      Action,
      | 'position'
      | 'assistId'
      | 'fouledId'
      | 'foulerId'
      | 'staffId'
      | 'rebound'
      | 'groupId'
      | 'goalkeeperId'
    >
  >

const PENALTY_TYPE: Record<string, ActionType> = {
  goal: 'penalty_goal',
  off: 'penalty_miss',
  stop: 'penalty_saved',
}
const REBOUND_TYPE: Record<string, ActionType> = {
  goal: 'goal',
  miss: 'shot',
  off: 'off_target',
}

const pos = (v: string | undefined): PositionCode | undefined =>
  v ? (v as PositionCode) : undefined

/** Turns finished answers into the actions to save (all share one groupId). */
export function buildActions(spec: FlowSpec, a: Answers, ctx: FlowContext): ActionDraft[] {
  const base = { matchId: ctx.matchId, groupId: ctx.groupId }
  const team = (side: 'own' | 'opp') => (side === 'own' ? ctx.ownTeamId : ctx.oppTeamId)

  switch (spec.kind) {
    case 'goal':
      return spec.side === 'own'
        ? [
            {
              ...base,
              teamId: ctx.ownTeamId,
              playerId: a.player,
              type: 'goal',
              position: pos(a.position),
              assistId: a.assist || undefined,
            },
          ]
        : [
            {
              ...base,
              teamId: ctx.oppTeamId,
              playerId: a.player,
              type: 'goal',
              position: pos(a.position),
              goalkeeperId: a.keeper || undefined,
            },
          ]
    case 'single':
      return [{ ...base, teamId: team(spec.side), playerId: a.player, type: spec.type }]
    case 'save':
      return [{ ...base, teamId: ctx.ownTeamId, playerId: a.keeper, type: 'save' }]
    case 'card': {
      const t = team(a.team === 'opp' ? 'opp' : 'own')
      const isStaff = a.person.startsWith('s:')
      const id = a.person.slice(2)
      return [
        {
          ...base,
          teamId: t,
          playerId: isStaff ? '' : id,
          staffId: isStaff ? id : undefined,
          type: spec.type,
        },
      ]
    }
    case 'penalty': {
      const own = spec.side === 'own'
      const shooterTeam = team(spec.side)
      // Goals against: the chosen keeper, else the keeper on court.
      const keeper = own ? undefined : a.keeper || ctx.ownGoalkeeperId
      const out: ActionDraft[] = [
        {
          ...base,
          teamId: shooterTeam,
          playerId: a.taker,
          type: PENALTY_TYPE[a.outcome],
          fouledId: a.fouled || undefined,
          foulerId: a.fouler || undefined,
          position: a.outcome === 'goal' ? 'P' : undefined,
          goalkeeperId: keeper,
        },
      ]
      if (a.outcome === 'stop' && a.after === 'rebound' && a.shooter) {
        out.push({
          ...base,
          teamId: shooterTeam,
          playerId: a.shooter,
          type: REBOUND_TYPE[a.outcome2],
          rebound: true,
          position: a.outcome2 === 'goal' ? pos(a.position2) : undefined,
          goalkeeperId: keeper,
        })
      }
      return out
    }
  }
}
