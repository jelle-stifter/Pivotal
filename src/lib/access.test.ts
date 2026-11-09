import { describe, expect, it } from 'vitest'
import { isViewerOnly, liveLockedByOther, matchAccess } from './access'
import type { Membership, Role } from './cloud'

const match = { homeTeamId: 'H', awayTeamId: 'A', scorerId: undefined as string | undefined }

function member(teamId: string, role: Role, extra: Partial<Membership> = {}): Membership {
  return {
    teamId,
    teamName: teamId,
    role,
    status: 'approved',
    canScore: false,
    inviteCode: null,
    joinOpen: true,
    ...extra,
  }
}

describe('matchAccess', () => {
  it('keeps the local app unchanged when no online team is involved', () => {
    expect(matchAccess(match, [], null)).toBe('score')
    expect(matchAccess(match, [member('OTHER', 'player')], 'u1')).toBe('score')
  })

  it('lets coach and assistant score', () => {
    expect(matchAccess(match, [member('H', 'coach')], 'u1')).toBe('score')
    expect(matchAccess(match, [member('A', 'assistant')], 'u1')).toBe('score')
  })

  it('gives a normal player statistics only', () => {
    expect(matchAccess(match, [member('H', 'player')], 'u1')).toBe('view')
  })

  it('lets a player score with the "mag scoren" flag', () => {
    expect(matchAccess(match, [member('H', 'player', { canScore: true })], 'u1')).toBe('score')
  })

  it('lets the scorer picked for this match score only that match', () => {
    const mine = [member('H', 'player')]
    expect(matchAccess({ ...match, scorerId: 'u1' }, mine, 'u1')).toBe('score')
    expect(matchAccess({ ...match, scorerId: 'someone-else' }, mine, 'u1')).toBe('view')
  })

  it('ignores a membership that is not approved yet', () => {
    expect(matchAccess(match, [member('H', 'coach', { status: 'pending' })], 'u1')).toBe('score')
    // pending = not connected yet, so the local behaviour applies (no data is shared before approval)
  })
})

describe('isViewerOnly', () => {
  it('is true only for players without scoring rights', () => {
    expect(isViewerOnly([member('H', 'player')])).toBe(true)
    expect(isViewerOnly([member('H', 'player', { canScore: true })])).toBe(false)
    expect(isViewerOnly([member('H', 'player'), member('X', 'coach')])).toBe(false)
    expect(isViewerOnly([])).toBe(false)
  })
})

describe('liveLockedByOther', () => {
  const now = 1_000_000
  it('is free for me, free without account, and locked by a fresh other scorer', () => {
    expect(liveLockedByOther({ liveBy: 'u1', liveAt: now }, 'u1', now)).toBeNull()
    expect(liveLockedByOther({ liveBy: 'u2', liveAt: now }, null, now)).toBeNull()
    expect(liveLockedByOther({ liveBy: 'u2', liveByName: 'Sam', liveAt: now }, 'u1', now)).toBe('Sam')
  })

  it('expires when stale, unless the clock is still running', () => {
    const old = now - 10 * 60_000
    expect(liveLockedByOther({ liveBy: 'u2', liveAt: old }, 'u1', now)).toBeNull()
    expect(liveLockedByOther({ liveBy: 'u2', liveAt: old, clockStartedAt: old }, 'u1', now)).toBe(
      'Iemand anders',
    )
  })
})
