import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const deleted: { table: string; ids: string[] }[] = []
vi.mock('./sync', async (orig) => ({
  ...(await orig<typeof import('./sync')>()),
  deleteIds: vi.fn(async (table: string, ids: string[]) => {
    deleted.push({ table, ids })
  }),
  upsertAll: vi.fn(async () => undefined),
}))

import { db, tracking } from '../db/schema'
import { createRepo } from '../db/repo'
import { flush } from './syncEngine'

beforeEach(async () => {
  deleted.length = 0
  tracking.enabled = () => true
  await Promise.all([db.teams.clear(), db.players.clear(), db.matches.clear(), db.actions.clear(), db.outbox.clear()])
})

const settle = () => new Promise((r) => setTimeout(r, 30))

describe('team delete reaches the server', () => {
  it('queues a team delete and sends it, children first (was: silently dropped)', async () => {
    const repo = createRepo(db)
    const t = await repo.addTeam('Weg')
    await repo.addPlayer({ teamId: t.id, name: 'A', number: 1, position: 'K', isGoalkeeper: true })
    await settle()
    await db.outbox.clear()

    await repo.deleteTeam(t.id)
    await settle()
    expect(await db.outbox.get(`teams:${t.id}`)).toMatchObject({ op: 'delete' })

    await flush('u1', [{ teamId: t.id, role: 'coach', status: 'approved' } as never])
    expect(deleted.map((d) => d.table)).toEqual(['players', 'teams'])
    expect(deleted.find((d) => d.table === 'teams')?.ids).toEqual([t.id])
    expect(await db.outbox.count()).toBe(0)
  })

})
