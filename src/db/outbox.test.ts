import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { PivotalDB, remoteTransactions, tracking } from './schema'
import { createRepo } from './repo'

let db: PivotalDB
let repo: ReturnType<typeof createRepo>
const original = tracking.enabled

beforeEach(() => {
  tracking.enabled = () => true
  db = new PivotalDB(`outbox-${Math.random()}`)
  repo = createRepo(db)
})

afterEach(() => {
  tracking.enabled = original
})

const settle = () => new Promise((r) => setTimeout(r, 20))

describe('outbox', () => {
  it('queues local changes', async () => {
    const t = await repo.addTeam('Thuis')
    const p = await repo.addPlayer({
      teamId: t.id,
      name: 'A',
      number: 1,
      position: 'K',
      isGoalkeeper: true,
    })
    await settle()
    const keys = (await db.outbox.toArray()).map((e) => e.key).sort()
    expect(keys).toEqual([`players:${p.id}`, `teams:${t.id}`].sort())
  })

  it('keeps only the latest change per row, delete wins', async () => {
    const t = await repo.addTeam('Thuis')
    await repo.renameTeam(t.id, 'Thuis 2')
    await settle()
    expect(await db.outbox.where('key').equals(`teams:${t.id}`).count()).toBe(1)
    await db.teams.delete(t.id)
    await settle()
    const entry = await db.outbox.get(`teams:${t.id}`)
    expect(entry?.op).toBe('delete')
  })

  it('does not queue when this device has no online teams', async () => {
    tracking.enabled = () => false
    await repo.addTeam('Alleen lokaal')
    await settle()
    expect(await db.outbox.count()).toBe(0)
  })

  it('does not queue writes that come from the server', async () => {
    await db.transaction('rw', db.teams, async () => {
      remoteTransactions.add(Dexie.currentTransaction as object)
      await db.teams.put({ id: 'remote', name: 'Van server', schemaVersion: 1 })
    })
    await settle()
    expect(await db.outbox.count()).toBe(0)
    expect(await db.teams.get('remote')).toBeDefined()
  })
})
