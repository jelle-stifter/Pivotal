import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { PivotalDB } from './schema'
import { createRepo } from './repo'
import { backupFileName, createBackup, parseBackup, restoreBackup } from './backup'

let db: PivotalDB
let repo: ReturnType<typeof createRepo>

beforeEach(() => {
  db = new PivotalDB(`test-${Math.random()}`)
  repo = createRepo(db)
})

describe('backup', () => {
  it('round-trips all data through JSON into an empty database', async () => {
    await repo.loadDemo('2026-11-08')
    const before = await createBackup(db, new Date('2026-11-08T10:00:00Z'))
    const text = JSON.stringify(before)

    const other = new PivotalDB(`test-${Math.random()}`)
    await restoreBackup(other, parseBackup(text))
    const after = await createBackup(other, new Date('2026-11-08T10:00:00Z'))
    expect(after).toEqual(before)
    expect(after.actions.length).toBeGreaterThan(100)
  })

  it('restore replaces existing data', async () => {
    await repo.addTeam('Oud')
    const other = new PivotalDB(`test-${Math.random()}`)
    await createRepo(other).addTeam('Nieuw')
    const backup = await createBackup(other)
    await restoreBackup(db, backup)
    const teams = await db.teams.toArray()
    expect(teams.map((t) => t.name)).toEqual(['Nieuw'])
  })

  it('rejects invalid files with a Dutch message', () => {
    expect(() => parseBackup('nope')).toThrow('geen geldig')
    expect(() => parseBackup('{"app":"x"}')).toThrow('geen Backhand')
    expect(() =>
      parseBackup('{"app":"pivotal","schemaVersion":99}'),
    ).toThrow('nieuwere versie')
    expect(() =>
      parseBackup('{"app":"pivotal","schemaVersion":1,"teams":[{}]}'),
    ).toThrow('ongeldig item')
  })

  it('builds a dated file name', () => {
    expect(backupFileName(new Date(2026, 10, 8))).toBe(
      'backhand-backup-2026-11-08.json',
    )
  })
})
