import { describe, expect, it } from 'vitest'
import { buildDemo, DEMO_MATCH_ID } from './demo'
import { hasPosition } from './court'
import { KEEPER_FACED_TYPES } from './actions'
import { goalkeeperStats, playerTotals, score, shotPercentage } from './stats'
import { ACTION_TYPES } from '../types'

const demo = buildDemo('2026-11-08', 1_000)

describe('buildDemo', () => {
  it('is deterministic', () => {
    expect(buildDemo('2026-11-08', 1_000)).toEqual(demo)
  })

  it('builds two teams of 8 players with one keeper each', () => {
    expect(demo.teams).toHaveLength(2)
    for (const t of demo.teams) {
      const ps = demo.players.filter((p) => p.teamId === t.id)
      expect(ps).toHaveLength(8)
      expect(ps.filter((p) => p.isGoalkeeper)).toHaveLength(1)
      expect(new Set(ps.map((p) => p.number)).size).toBe(8) // unique shirt numbers
    }
  })

  it('has unique ids and only references existing teams and players', () => {
    const ids = demo.actions.map((a) => a.id)
    expect(new Set(ids).size).toBe(ids.length)
    const playerIds = new Set(demo.players.map((p) => p.id))
    const matchIds = new Set(demo.matches.map((m) => m.id))
    const byId = new Map(demo.players.map((p) => [p.id, p]))
    for (const a of demo.actions) {
      expect(matchIds.has(a.matchId)).toBe(true)
      expect(playerIds.has(a.playerId)).toBe(true)
      expect(byId.get(a.playerId)?.teamId).toBe(a.teamId)
    }
  })

  it('covers every action type and gives every action a valid position', () => {
    for (const t of ACTION_TYPES)
      expect(demo.actions.some((a) => a.type === t)).toBe(true)
    for (const a of demo.actions) {
      expect(hasPosition(a)).toBe(true)
      expect(a.x!).toBeGreaterThanOrEqual(0)
      expect(a.x!).toBeLessThanOrEqual(1)
      expect(a.y!).toBeGreaterThanOrEqual(0)
      expect(a.y!).toBeLessThanOrEqual(1)
    }
  })

  it('builds four matches on different dates, the first being the most recent', () => {
    expect(demo.matches).toHaveLength(4)
    expect(demo.match).toBe(demo.matches[0])
    expect(demo.match.id).toBe(DEMO_MATCH_ID)
    const dates = demo.matches.map((m) => m.date)
    expect(new Set(dates).size).toBe(4)
    expect([...dates].sort().reverse()).toEqual(dates) // newest first
    expect(dates[0]).toBe('2026-11-08')
    // home and away alternate so both views are exercised
    expect(new Set(demo.matches.map((m) => m.homeTeamId)).size).toBe(2)
  })

  it('is in match order per match, with periods matching the clock (2 halves)', () => {
    for (const m of demo.matches) {
      const own = demo.actions
        .filter((a) => a.matchId === m.id)
        .sort((a, b) => a.createdAt - b.createdAt)
      expect(own.length).toBeGreaterThan(100)
      for (let i = 1; i < own.length; i++)
        expect(own[i].matchClockMs).toBeGreaterThanOrEqual(own[i - 1].matchClockMs)
      for (const a of own)
        expect(a.period).toBe(a.matchClockMs < 1_800_000 ? 1 : 2)
      expect(m.format).toBe(2)
    }
  })

  it('gives a varied season: a win, a draw and a loss for HV Pivotal', () => {
    const letters = demo.matches.map((m) => {
      const s = score(
        demo.actions.filter((a) => a.matchId === m.id),
        m.homeTeamId,
        m.awayTeamId,
      )
      const mine = m.homeTeamId === 'demo-home' ? s.home : s.away
      const theirs = m.homeTeamId === 'demo-home' ? s.away : s.home
      return mine > theirs ? 'W' : mine < theirs ? 'V' : 'G'
    })
    expect(new Set(letters)).toEqual(new Set(['W', 'G', 'V']))
    expect(letters[0]).toBe('W') // the original demo match, 31 - 27
  })

  it('credits every goal and 7-meter outcome to the opposing keeper', () => {
    const faced = demo.actions.filter((a) => KEEPER_FACED_TYPES.includes(a.type))
    expect(faced.length).toBeGreaterThan(0)
    for (const g of faced) {
      const gk = demo.players.find((p) => p.id === g.goalkeeperId)
      expect(gk?.isGoalkeeper).toBe(true)
      expect(gk?.teamId).not.toBe(g.teamId)
    }
  })

  it('keeps the 7-meter numbers consistent: penalties won = penalties taken', () => {
    for (const [teamId, matchId] of demo.matches.flatMap((m) =>
      ['demo-home', 'demo-away'].map((t) => [t, m.id] as const),
    )) {
      const n = (t: string) =>
        demo.actions.filter(
          (a) => a.matchId === matchId && a.teamId === teamId && a.type === t,
        ).length
      expect(n('penalty_won')).toBe(
        n('penalty_goal') + n('penalty_saved') + n('penalty_miss'),
      )
    }
  })

  it('has a shot percentage between 0 and 100% for every field player who shot', () => {
    const totals = playerTotals(demo.actions)
    let checked = 0
    for (const t of totals.values()) {
      const p = shotPercentage(t)
      if (p !== null) {
        expect(p).toBeGreaterThanOrEqual(0)
        expect(p).toBeLessThanOrEqual(1)
        checked++
      }
    }
    expect(checked).toBeGreaterThan(5)
  })

  it('produces the planned score and sensible keeper stats', () => {
    const first = demo.actions.filter((a) => a.matchId === DEMO_MATCH_ID)
    expect(score(first, 'demo-home', 'demo-away')).toEqual({ home: 31, away: 27 })
    const gks = demo.players.filter((p) => p.isGoalkeeper).map((p) => p.id)
    for (const g of goalkeeperStats(first, gks)) {
      expect(g.savePercentage).not.toBeNull()
      expect(g.savePercentage!).toBeGreaterThan(0)
      expect(g.savePercentage!).toBeLessThan(1)
    }
  })

  it('puts goals close to the opponent goal (attack-normalized x)', () => {
    const goals = demo.actions.filter((a) => a.type === 'goal')
    const mean = goals.reduce((s, g) => s + g.x!, 0) / goals.length
    expect(mean).toBeGreaterThan(0.7)
  })
})
