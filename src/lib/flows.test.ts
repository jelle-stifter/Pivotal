import { describe, expect, it } from 'vitest'
import {
  buildActions,
  lastAnsweredKey,
  nextStep,
  stepsFor,
  type Answers,
  type FlowContext,
  type FlowSpec,
} from './flows'

const ctx: FlowContext = {
  matchId: 'm1',
  ownTeamId: 'HVM',
  oppTeamId: 'EHV',
  ownGoalkeeperId: 'gk1',
  groupId: 'g1',
}

/** Walk a flow by answering each next step from `answers`. */
function walk(spec: FlowSpec, answers: Answers): string[] {
  const done: Answers = {}
  const order: string[] = []
  for (let i = 0; i < 20; i++) {
    const s = nextStep(spec, done)
    if (!s) return order
    if (!(s.key in answers)) throw new Error(`no answer for ${s.key}`)
    done[s.key] = answers[s.key]
    order.push(s.key)
  }
  throw new Error('flow does not end')
}

describe('own goal', () => {
  const spec: FlowSpec = { kind: 'goal', side: 'own' }
  it('asks player, position, assist', () => {
    expect(walk(spec, { player: 'p7', position: 'LH', assist: 'p9' })).toEqual([
      'player',
      'position',
      'assist',
    ])
  })
  it('saves position and assist on one goal; the assist may stay empty', () => {
    const [a] = buildActions(spec, { player: 'p7', position: 'LH', assist: 'p9' }, ctx)
    expect(a).toMatchObject({ teamId: 'HVM', playerId: 'p7', type: 'goal', position: 'LH', assistId: 'p9' })
    const [b] = buildActions(spec, { player: 'p7', position: 'RO', assist: '' }, ctx)
    expect(b.assistId).toBeUndefined()
  })
  it('offers the assist as optional and without the scorer', () => {
    const assist = stepsFor(spec, {}).find((s) => s.key === 'assist')!
    expect(assist.optional).toBe(true)
    expect(assist.excludeKey).toBe('player')
  })
})

describe('goal against', () => {
  const spec: FlowSpec = { kind: 'goal', side: 'opp' }
  it('asks the keeper first, every time', () => {
    expect(nextStep(spec, {})!.key).toBe('keeper')
    expect(nextStep(spec, {})!.kind).toBe('ownKeeper')
  })
  it('saves the opponent goal with the chosen keeper', () => {
    const [a] = buildActions(spec, { keeper: 'gk2', player: 'o7', position: 'C' }, ctx)
    expect(a).toMatchObject({ teamId: 'EHV', playerId: 'o7', type: 'goal', goalkeeperId: 'gk2', position: 'C' })
  })
})

describe('penalty for our team', () => {
  const spec: FlowSpec = { kind: 'penalty', side: 'own' }
  const base = { fouled: 'p4', fouler: 'o3', taker: 'p7' }

  it('goal: one penalty_goal with fouled, fouler and the penalty position', () => {
    expect(walk(spec, { ...base, outcome: 'goal' })).toEqual(['fouled', 'fouler', 'taker', 'outcome'])
    const out = buildActions(spec, { ...base, outcome: 'goal' }, ctx)
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({
      teamId: 'HVM', playerId: 'p7', type: 'penalty_goal', fouledId: 'p4', foulerId: 'o3', position: 'P', groupId: 'g1',
    })
  })
  it('off target: penalty_miss; stop: penalty_saved', () => {
    expect(buildActions(spec, { ...base, outcome: 'off' }, ctx)[0].type).toBe('penalty_miss')
    expect(buildActions(spec, { ...base, outcome: 'stop', after: 'ball' }, ctx)[0].type).toBe('penalty_saved')
  })
  it('stop + ball to the opponent: no rebound action', () => {
    expect(buildActions(spec, { ...base, outcome: 'stop', after: 'ball' }, ctx)).toHaveLength(1)
    expect(walk(spec, { ...base, outcome: 'stop', after: 'ball' })).toEqual([
      'fouled', 'fouler', 'taker', 'outcome', 'after',
    ])
  })
  it('stop + rebound: a second shooter with an outcome, linked by the group', () => {
    const answers = { ...base, outcome: 'stop', after: 'rebound', shooter: 'p9', outcome2: 'goal', position2: 'RH' }
    expect(walk(spec, answers)).toEqual([
      'fouled', 'fouler', 'taker', 'outcome', 'after', 'shooter', 'outcome2', 'position2',
    ])
    const out = buildActions(spec, answers, ctx)
    expect(out).toHaveLength(2)
    expect(out[1]).toMatchObject({ teamId: 'HVM', playerId: 'p9', type: 'goal', rebound: true, position: 'RH', groupId: 'g1' })
  })
  it('rebound outcomes: Mis = shot, Niet op doel = off_target; no position then', () => {
    const r = (outcome2: string) =>
      buildActions(spec, { ...base, outcome: 'stop', after: 'rebound', shooter: 'p9', outcome2 }, ctx)[1]
    expect(r('miss').type).toBe('shot')
    expect(r('off').type).toBe('off_target')
    expect(walk(spec, { ...base, outcome: 'stop', after: 'rebound', shooter: 'p9', outcome2: 'miss' })).not.toContain('position2')
  })
  it('does not ask a keeper (the opponent keeper is not tracked here)', () => {
    expect(stepsFor(spec, { outcome: 'stop' }).some((s) => s.key === 'keeper')).toBe(false)
  })
  it('offers the top 3 as quick choice for the taker', () => {
    expect(stepsFor(spec, {}).find((s) => s.key === 'taker')!.quick).toBe(true)
  })
})

describe('penalty against our team', () => {
  const spec: FlowSpec = { kind: 'penalty', side: 'opp' }
  const base = { fouled: 'o3', fouler: 'p4', taker: 'o7' }

  it('asks the opponent side first and the keeper only after a stop', () => {
    expect(stepsFor(spec, {})[0]).toMatchObject({ key: 'fouled', kind: 'oppPlayer' })
    expect(stepsFor(spec, {})[1]).toMatchObject({ key: 'fouler', kind: 'ownPlayer' })
    expect(stepsFor(spec, { outcome: 'goal' }).some((s) => s.key === 'keeper')).toBe(false)
    expect(stepsFor(spec, { outcome: 'stop' }).some((s) => s.key === 'keeper')).toBe(true)
  })
  it('goal: the opponent scores; the keeper on court is credited', () => {
    const [a] = buildActions(spec, { ...base, outcome: 'goal' }, ctx)
    expect(a).toMatchObject({ teamId: 'EHV', playerId: 'o7', type: 'penalty_goal', goalkeeperId: 'gk1', position: 'P' })
  })
  it('stop: credits the chosen own keeper; a rebound keeps that keeper', () => {
    const answers = { ...base, outcome: 'stop', keeper: 'gk2', after: 'rebound', shooter: 'o9', outcome2: 'off' }
    const out = buildActions(spec, answers, ctx)
    expect(out[0]).toMatchObject({ type: 'penalty_saved', goalkeeperId: 'gk2' })
    expect(out[1]).toMatchObject({ teamId: 'EHV', playerId: 'o9', type: 'off_target', rebound: true, goalkeeperId: 'gk2' })
  })
})

describe('single actions', () => {
  it('only asks for a player', () => {
    const spec: FlowSpec = { kind: 'single', side: 'own', type: 'block' }
    expect(walk(spec, { player: 'p5' })).toEqual(['player'])
    expect(buildActions(spec, { player: 'p5' }, ctx)).toEqual([
      { matchId: 'm1', groupId: 'g1', teamId: 'HVM', playerId: 'p5', type: 'block' },
    ])
  })
  it('opponent off target picks an opponent', () => {
    const spec: FlowSpec = { kind: 'single', side: 'opp', type: 'off_target' }
    expect(nextStep(spec, {})!.kind).toBe('oppPlayer')
    expect(buildActions(spec, { player: 'o4' }, ctx)[0]).toMatchObject({ teamId: 'EHV', type: 'off_target' })
  })
  it('opponent shot stopped: a save by one of our keepers', () => {
    const spec: FlowSpec = { kind: 'save' }
    expect(nextStep(spec, {})!.kind).toBe('ownKeeper')
    expect(buildActions(spec, { keeper: 'gk2' }, ctx)[0]).toMatchObject({ teamId: 'HVM', playerId: 'gk2', type: 'save' })
  })
})

describe('cards and suspensions', () => {
  const spec: FlowSpec = { kind: 'card', type: 'suspension' }
  it('asks the team, then a person of that team', () => {
    expect(nextStep(spec, {})!.key).toBe('team')
    expect(nextStep(spec, { team: 'opp' })).toMatchObject({ key: 'person', team: 'opp' })
    expect(nextStep(spec, { team: 'own' })).toMatchObject({ key: 'person', team: 'own' })
  })
  it('a player gets the card on playerId', () => {
    const [a] = buildActions(spec, { team: 'own', person: 'p:p5' }, ctx)
    expect(a).toMatchObject({ teamId: 'HVM', playerId: 'p5', type: 'suspension' })
    expect(a.staffId).toBeUndefined()
  })
  it('a staff member gets it on staffId (no player)', () => {
    const [a] = buildActions({ kind: 'card', type: 'yellow_card' }, { team: 'opp', person: 's:coach1' }, ctx)
    expect(a).toMatchObject({ teamId: 'EHV', playerId: '', staffId: 'coach1', type: 'yellow_card' })
  })
})

describe('going back', () => {
  it('removes the most recent answer', () => {
    const spec: FlowSpec = { kind: 'goal', side: 'own' }
    expect(lastAnsweredKey(spec, {})).toBeNull()
    expect(lastAnsweredKey(spec, { player: 'p7', position: 'LH' })).toBe('position')
  })
  it('an empty (skipped) answer counts as answered', () => {
    const spec: FlowSpec = { kind: 'goal', side: 'own' }
    expect(nextStep(spec, { player: 'p7', position: 'M', assist: '' })).toBeNull()
  })
})

import { TODO_ANSWER } from './flows'

describe('skip: fill in after the match', () => {
  it('saves a goal against without scorer or keeper, marked as todo (keeper is not guessed)', () => {
    const [a] = buildActions({ kind: 'goal', side: 'opp' }, { keeper: TODO_ANSWER, player: TODO_ANSWER, position: 'LH' }, ctx)
    expect(a).toMatchObject({ teamId: 'EHV', playerId: '', type: 'goal', position: 'LH', todo: ['speler', 'keeper'] })
    expect(a.goalkeeperId).toBeUndefined()
  })
  it('saves an own goal without scorer; a chosen player leaves no todo', () => {
    const spec: FlowSpec = { kind: 'goal', side: 'own' }
    expect(buildActions(spec, { player: TODO_ANSWER, position: 'M', assist: '' }, ctx)[0]).toMatchObject({
      playerId: '',
      todo: ['speler'],
    })
    expect(buildActions(spec, { player: 'p7', position: 'M', assist: '' }, ctx)[0].todo).toBeUndefined()
  })
  it('skips work for single actions, penalties and cards', () => {
    expect(buildActions({ kind: 'single', side: 'own', type: 'shot' }, { player: TODO_ANSWER }, ctx)[0]).toMatchObject({
      playerId: '',
      todo: ['speler'],
    })
    const pen = buildActions(
      { kind: 'penalty', side: 'opp' },
      { fouled: TODO_ANSWER, fouler: 'p4', taker: TODO_ANSWER, outcome: 'goal', keeper: TODO_ANSWER },
      ctx,
    )[0]
    expect(pen).toMatchObject({ playerId: '', type: 'penalty_goal', todo: ['speler', 'keeper'] })
    expect(pen.goalkeeperId).toBeUndefined()
    expect(pen.fouledId).toBeUndefined()
    expect(
      buildActions({ kind: 'card', type: 'yellow_card' }, { team: 'own', person: TODO_ANSWER }, ctx)[0],
    ).toMatchObject({ playerId: '', todo: ['speler'] })
  })
})

describe('stop (opponent shoots, our keeper stops)', () => {
  const spec: FlowSpec = { kind: 'save' }
  it('asks the keeper and then which opponent shot', () => {
    expect(walk(spec, { keeper: 'gk1', shooter: 'o7' })).toEqual(['keeper', 'shooter'])
    expect(nextStep(spec, { keeper: 'gk1' })!.kind).toBe('oppPlayer')
  })
  it('stores the shooter; skipping marks it as todo', () => {
    expect(buildActions(spec, { keeper: 'gk1', shooter: 'o7' }, ctx)[0]).toMatchObject({
      type: 'save',
      playerId: 'gk1',
      shooterId: 'o7',
    })
    const skipped = buildActions(spec, { keeper: 'gk1', shooter: TODO_ANSWER }, ctx)[0]
    expect(skipped.shooterId).toBeUndefined()
    expect(skipped.todo).toEqual(['schutter'])
  })
})

describe('skip the assist', () => {
  const spec: FlowSpec = { kind: 'goal', side: 'own' }
  it('stores no assist and marks it as todo; "Geen assist" stays without a mark', () => {
    const skipped = buildActions(spec, { player: 'p7', position: 'LH', assist: TODO_ANSWER }, ctx)[0]
    expect(skipped.assistId).toBeUndefined()
    expect(skipped.todo).toEqual(['assist'])
    expect(buildActions(spec, { player: 'p7', position: 'LH', assist: '' }, ctx)[0].todo).toBeUndefined()
  })
  it('combines with a skipped scorer', () => {
    expect(buildActions(spec, { player: TODO_ANSWER, position: 'LH', assist: TODO_ANSWER }, ctx)[0].todo).toEqual([
      'speler',
      'assist',
    ])
  })
})

describe('skip the position', () => {
  it('saves a goal without position, marked as todo (own and against)', () => {
    const own = buildActions({ kind: 'goal', side: 'own' }, { player: 'p7', position: TODO_ANSWER, assist: '' }, ctx)[0]
    expect(own.position).toBeUndefined()
    expect(own.todo).toEqual(['positie'])
    const against = buildActions({ kind: 'goal', side: 'opp' }, { keeper: 'gk1', player: 'o7', position: TODO_ANSWER }, ctx)[0]
    expect(against.position).toBeUndefined()
    expect(against.todo).toEqual(['positie'])
  })
  it('a rebound goal without position is marked; a rebound miss is not', () => {
    const spec: FlowSpec = { kind: 'penalty', side: 'own' }
    const base = { fouled: 'p4', fouler: 'o3', taker: 'p7', outcome: 'stop', after: 'rebound', shooter: 'p9' }
    const goal = buildActions(spec, { ...base, outcome2: 'goal', position2: TODO_ANSWER }, ctx)[1]
    expect(goal.todo).toEqual(['positie'])
    const miss = buildActions(spec, { ...base, outcome2: 'miss' }, ctx)[1]
    expect(miss.todo).toBeUndefined()
  })
})
