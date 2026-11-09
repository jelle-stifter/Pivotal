import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { beforeEach, describe, expect, it } from 'vitest'
import { PivotalDB, db as appDb, tracking } from './schema'
import { createRepo } from './repo'
import { POSITION_POINT } from '../lib/positions'

let db: PivotalDB
let repo: ReturnType<typeof createRepo>

beforeEach(() => {
  db = new PivotalDB(`test-${Math.random()}`)
  repo = createRepo(db)
})

async function setup() {
  const h = await repo.addTeam('HVM')
  const a = await repo.addTeam('EHV')
  const hp = await repo.addPlayer({ teamId: h.id, name: 'HP', number: 7, position: '', isGoalkeeper: false })
  const agk = await repo.addPlayer({ teamId: a.id, name: 'AK', number: 1, position: 'K', isGoalkeeper: true })
  const hk = await repo.addPlayer({ teamId: h.id, name: 'HK', number: 1, position: 'K', isGoalkeeper: true })
  const hk2 = await repo.addPlayer({ teamId: h.id, name: 'HK2', number: 16, position: 'K', isGoalkeeper: true })
  const m = await repo.addMatch({ homeTeamId: h.id, awayTeamId: a.id, date: '2026-11-09' })
  return { h, a, hp, agk, hk, hk2, m }
}

describe('new match defaults', () => {
  it('is always 2 halves and HVM plays at home unless chosen', async () => {
    const s = await setup()
    expect(s.m.format).toBe(2)
    expect(s.m.ownSide).toBe('home')
    const away = await repo.addMatch({
      homeTeamId: s.a.id, awayTeamId: s.h.id, date: '2026-11-10',
      time: '19:30', ownSide: 'away', opponentColor: '#2563eb',
    })
    expect(away).toMatchObject({ ownSide: 'away', time: '19:30', opponentColor: '#2563eb', format: 2 })
  })
})

describe('logAction with the new fields', () => {
  it('stores position, assist, fouled and fouler', async () => {
    const s = await setup()
    const a = await repo.logAction({
      matchId: s.m.id, teamId: s.h.id, playerId: s.hp.id, type: 'goal',
      position: 'LH', assistId: 'x', fouledId: 'f', foulerId: 'g', groupId: 'grp',
    })
    expect(a).toMatchObject({ position: 'LH', assistId: 'x', fouledId: 'f', foulerId: 'g', groupId: 'grp' })
  })
  it('a position code gives the action its spot for the heatmaps', async () => {
    const s = await setup()
    const a = await repo.logAction({
      matchId: s.m.id, teamId: s.h.id, playerId: s.hp.id, type: 'goal', position: 'RH',
    })
    expect(a.x).toBe(POSITION_POINT.RH.x)
    expect(a.y).toBe(POSITION_POINT.RH.y)
  })
  it('an explicit court click wins over the code', async () => {
    const s = await setup()
    const a = await repo.logAction({
      matchId: s.m.id, teamId: s.h.id, playerId: s.hp.id, type: 'goal', position: 'RH', x: 0.5, y: 0.5,
    })
    expect([a.x, a.y]).toEqual([0.5, 0.5])
  })
  it('the keeper chosen on screen overrides the keeper on court', async () => {
    const s = await setup()
    await repo.setActiveGoalkeeper(s.m.id, 'home', s.hk.id)
    const a = await repo.logAction({
      matchId: s.m.id, teamId: s.a.id, playerId: s.agk.id, type: 'goal', goalkeeperId: s.hk2.id,
    })
    expect(a.goalkeeperId).toBe(s.hk2.id)
    const b = await repo.logAction({
      matchId: s.m.id, teamId: s.a.id, playerId: s.agk.id, type: 'goal',
    })
    expect(b.goalkeeperId).toBe(s.hk.id) // default: the keeper on court
  })
  it('a staff member can get a card (no player)', async () => {
    const s = await setup()
    const a = await repo.logAction({
      matchId: s.m.id, teamId: s.h.id, playerId: '', staffId: 'coach', type: 'yellow_card',
    })
    expect(a).toMatchObject({ playerId: '', staffId: 'coach' })
  })
})

describe('undo', () => {
  it('removes a whole flow (penalty + rebound) at once', async () => {
    const s = await setup()
    await repo.logAction({ matchId: s.m.id, teamId: s.h.id, playerId: s.hp.id, type: 'shot' })
    await new Promise((r) => setTimeout(r, 3))
    await repo.logAction({ matchId: s.m.id, teamId: s.h.id, playerId: s.hp.id, type: 'penalty_saved', groupId: 'g' })
    await new Promise((r) => setTimeout(r, 3))
    await repo.logAction({ matchId: s.m.id, teamId: s.h.id, playerId: s.hp.id, type: 'goal', rebound: true, groupId: 'g' })
    await repo.undoLastAction(s.m.id)
    const left = await db.actions.where('matchId').equals(s.m.id).toArray()
    expect(left.map((a) => a.type)).toEqual(['shot'])
  })
  it('still removes a single action', async () => {
    const s = await setup()
    await repo.logAction({ matchId: s.m.id, teamId: s.h.id, playerId: s.hp.id, type: 'shot' })
    await repo.undoLastAction(s.m.id)
    expect(await db.actions.count()).toBe(0)
  })
})

describe('Dexie migration to version 3', () => {
  it('gives older matches ownSide home, keeps everything else, and does not queue uploads', async () => {
    const name = `migrate-${Math.random()}`
    // Old database: version 2 as it was before.
    const old = new Dexie(name)
    old.version(1).stores({
      teams: 'id, name',
      players: 'id, teamId, number',
      matches: 'id, date',
      actions: 'id, matchId, teamId, playerId, type, period, createdAt',
    })
    old.version(2).stores({ outbox: 'key, table' })
    await old.table('matches').add({
      id: 'old', homeTeamId: 'a', awayTeamId: 'b', date: '2025-01-01', format: 3,
      currentPeriod: 3, clockMs: 5000, activeGoalkeeper: {}, schemaVersion: 1,
    })
    old.close()

    const wasEnabled = tracking.enabled
    tracking.enabled = () => true
    try {
      const upgraded = new PivotalDB(name)
      const m = await upgraded.matches.get('old')
      expect(m).toMatchObject({ ownSide: 'home', format: 3, currentPeriod: 3, clockMs: 5000 })
      await new Promise((r) => setTimeout(r, 20))
      expect(await upgraded.outbox.count()).toBe(0)
      upgraded.close()
    } finally {
      tracking.enabled = wasEnabled
    }
  })
  it('the app database is still constructible', () => {
    expect(appDb.verno).toBe(3)
  })
})

describe('team staff and short name', () => {
  it('stores a short name and staff members on the team', async () => {
    const t = await repo.addTeam('Eindhoven')
    await repo.updateTeam(t.id, {
      shortName: 'EHV',
      staff: [{ id: 's1', name: 'Kees', role: 'Eerste trainer' }],
    })
    expect(await db.teams.get(t.id)).toMatchObject({
      name: 'Eindhoven',
      shortName: 'EHV',
      staff: [{ id: 's1', name: 'Kees', role: 'Eerste trainer' }],
    })
  })
  it('keeps the absence list and penalty takers on the match', async () => {
    const s = await setup()
    await repo.updateMatch(s.m.id, {
      absent: { [s.hp.id]: 'blessure' },
      penaltyTakers: [s.hk.id],
      time: '14:30',
    })
    expect(await db.matches.get(s.m.id)).toMatchObject({
      absent: { [s.hp.id]: 'blessure' },
      penaltyTakers: [s.hk.id],
      time: '14:30',
    })
  })
})
