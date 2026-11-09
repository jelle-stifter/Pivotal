import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { matchesScoredHere } from './sync'
import type { Match } from '../types'

const base: Match = {
  id: 'm1',
  homeTeamId: 'H',
  awayTeamId: 'A',
  date: '2026-11-09',
  format: 2,
  currentPeriod: 1,
  clockMs: 0,
  activeGoalkeeper: {},
  schemaVersion: 1,
}

describe('matchesScoredHere', () => {
  it('protects only the match whose clock runs under my own account', () => {
    const mine = { ...base, id: 'mine', clockStartedAt: 1, liveBy: 'me' }
    const copied = { ...base, id: 'copied', clockStartedAt: 1, liveBy: 'coach' }
    expect([...matchesScoredHere([mine, copied], 'me')]).toEqual(['mine'])
  })

  it('does not protect a paused, finished or unclaimed match, or without account', () => {
    const paused = { ...base, id: 'p', liveBy: 'me' }
    const done = { ...base, id: 'd', clockStartedAt: 1, liveBy: 'me', finishedAt: 5 }
    const none = { ...base, id: 'n', clockStartedAt: 1 }
    expect(matchesScoredHere([paused, done, none], 'me').size).toBe(0)
    expect(matchesScoredHere([{ ...base, clockStartedAt: 1, liveBy: 'me' }], null).size).toBe(0)
  })
})

import { lockPatch } from './sync'

describe('lockPatch', () => {
  const local: Match = { ...base, liveBy: 'coach', liveByName: 'Coach', liveAt: 100 }
  it('adopts a newer claim by someone else', () => {
    const remote = { ...base, liveBy: 'sam', liveByName: 'Sam', liveAt: 200 }
    expect(lockPatch(local, remote)).toEqual({ liveBy: 'sam', liveByName: 'Sam', liveAt: 200 })
  })
  it('ignores older claims and the same person', () => {
    expect(lockPatch(local, { ...base, liveBy: 'sam', liveAt: 50 })).toBeNull()
    expect(lockPatch(local, { ...base, liveBy: 'coach', liveAt: 500 })).toBeNull()
  })
})

import { beforeEach } from 'vitest'
import { db } from '../db/schema'
import { pruneLocal } from './sync'

describe('pruneLocal (deleted online, gone for the player)', () => {
  beforeEach(async () => {
    await Promise.all([db.players.clear(), db.matches.clear(), db.actions.clear(), db.outbox.clear()])
  })

  const act = (id: string, matchId: string) =>
    ({ id, matchId, teamId: 'H', playerId: 'p1', type: 'goal', period: 1, matchClockMs: 0, createdAt: 1, videoTimeMs: null, schemaVersion: 1 }) as const

  it('removes local rows that no longer exist online', async () => {
    await db.matches.bulkPut([base, { ...base, id: 'm2' }])
    await db.actions.bulkPut([act('a1', 'm1'), act('a2', 'm1'), act('a3', 'm2')])
    await pruneLocal(['H'], {
      players: new Set(),
      matches: new Set(['m1']), // m2 was deleted online
      actions: new Set(['a1']), // a2 was undone online
    })
    expect((await db.matches.toArray()).map((m) => m.id)).toEqual(['m1'])
    expect((await db.actions.toArray()).map((a) => a.id)).toEqual(['a1'])
  })

  it('keeps rows with a local change waiting for upload', async () => {
    await db.matches.put(base)
    await db.actions.bulkPut([act('a1', 'm1'), act('new', 'm1')])
    await db.outbox.put({ key: 'actions:new', table: 'actions', id: 'new', op: 'put', at: 1 })
    await pruneLocal(['H'], { players: new Set(), matches: new Set(['m1']), actions: new Set() })
    expect((await db.actions.toArray()).map((a) => a.id)).toEqual(['new'])
  })
})
