import type { Action, ActionType, PositionCode, TodoField } from '../types'

/** Answer value for "skip, fill in after the match". */
export const TODO_ANSWER = '?'

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
      return [
        { key: 'keeper', title: 'Welke keeper stopte?', kind: 'ownKeeper' },
        { key: 'shooter', title: 'Welke tegenstander schoot?', kind: 'oppPlayer' },
      ]
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
      | 'shooterId'
      | 'todo'
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

const skipped = (v: string | undefined) => v === TODO_ANSWER
/** The chosen id, or empty when it was skipped. */
const id = (v: string | undefined) => (v && !skipped(v) ? v : '')
const todo = (...list: [boolean, TodoField][]): TodoField[] | undefined => {
  const t = list.filter(([on]) => on).map(([, f]) => f)
  return t.length > 0 ? t : undefined
}

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
              playerId: id(a.player),
              type: 'goal',
              position: pos(a.position),
              assistId: id(a.assist) || undefined,
              todo: todo([skipped(a.player), 'speler'], [skipped(a.assist), 'assist']),
            },
          ]
        : [
            {
              ...base,
              teamId: ctx.oppTeamId,
              playerId: id(a.player),
              type: 'goal',
              position: pos(a.position),
              goalkeeperId: id(a.keeper) || undefined,
              todo: todo([skipped(a.player), 'speler'], [skipped(a.keeper), 'keeper']),
            },
          ]
    case 'single':
      return [
        {
          ...base,
          teamId: team(spec.side),
          playerId: id(a.player),
          type: spec.type,
          todo: todo([skipped(a.player), 'speler']),
        },
      ]
    case 'save':
      return [
        {
          ...base,
          teamId: ctx.ownTeamId,
          playerId: id(a.keeper),
          type: 'save',
          shooterId: id(a.shooter) || undefined,
          todo: todo([skipped(a.keeper), 'speler'], [skipped(a.shooter), 'schutter']),
        },
      ]
    case 'card': {
      const t = team(a.team === 'opp' ? 'opp' : 'own')
      const isStaff = a.person.startsWith('s:')
      const pid = skipped(a.person) ? '' : a.person.slice(2)
      return [
        {
          ...base,
          teamId: t,
          playerId: isStaff ? '' : pid,
          staffId: isStaff ? pid : undefined,
          type: spec.type,
          todo: todo([skipped(a.person), 'speler']),
        },
      ]
    }
    case 'penalty': {
      const own = spec.side === 'own'
      const shooterTeam = team(spec.side)
      // Goals against: the chosen keeper, else the keeper on court (unless skipped).
      const keeper = own ? undefined : skipped(a.keeper) ? undefined : a.keeper || ctx.ownGoalkeeperId
      const keeperTodo = !own && skipped(a.keeper)
      const out: ActionDraft[] = [
        {
          ...base,
          teamId: shooterTeam,
          playerId: id(a.taker),
          type: PENALTY_TYPE[a.outcome],
          fouledId: id(a.fouled) || undefined,
          foulerId: id(a.fouler) || undefined,
          position: a.outcome === 'goal' ? 'P' : undefined,
          goalkeeperId: keeper,
          todo: todo([skipped(a.taker), 'speler'], [keeperTodo, 'keeper']),
        },
      ]
      if (a.outcome === 'stop' && a.after === 'rebound' && a.shooter) {
        out.push({
          ...base,
          teamId: shooterTeam,
          playerId: id(a.shooter),
          type: REBOUND_TYPE[a.outcome2],
          rebound: true,
          position: a.outcome2 === 'goal' ? pos(a.position2) : undefined,
          goalkeeperId: keeper,
          todo: todo([skipped(a.shooter), 'speler'], [keeperTodo, 'keeper']),
        })
      }
      return out
    }
  }
}
