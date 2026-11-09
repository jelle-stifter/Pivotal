import type { AbsenceReason, Match, Player, StaffMember } from '../types'

export const ABSENCE_LABEL: Record<AbsenceReason, string> = {
  afwezig: 'Afwezig',
  blessure: 'Blessure',
  niet_in_selectie: 'Niet in selectie',
}

export const ABSENCE_REASONS = Object.keys(ABSENCE_LABEL) as AbsenceReason[]

/** Staff roles offered in the dropdown; the role itself is free text. */
export const STAFF_ROLES = [
  'Eerste trainer',
  'Tweede trainer',
  'Assistent',
  'Teammanager',
  'Fysio',
  'Overig',
]

/** Marks a player as not playing (with a reason), or as playing again (null). */
export function setAbsence(
  absent: Match['absent'],
  playerId: string,
  reason: AbsenceReason | null,
): Record<string, AbsenceReason> {
  const next = { ...(absent ?? {}) }
  if (reason) next[playerId] = reason
  else delete next[playerId]
  return next
}

/** Own players that play in this match (everyone who is not marked absent). */
export function playingPlayers(
  match: Pick<Match, 'absent'>,
  players: Player[],
): Player[] {
  return players.filter((p) => !match.absent?.[p.id])
}

/**
 * Sets slot 0..2 of the top-3 penalty takers. A player can only be in the
 * list once; an empty id clears the slot. Gaps are closed, so the list is
 * always best-first.
 */
export function setPenaltyTaker(
  takers: string[] | undefined,
  slot: number,
  playerId: string,
): string[] {
  const slots: string[] = [takers?.[0] ?? '', takers?.[1] ?? '', takers?.[2] ?? '']
  for (let i = 0; i < 3; i++) if (playerId && slots[i] === playerId) slots[i] = ''
  if (slot >= 0 && slot < 3) slots[slot] = playerId
  return slots.filter(Boolean)
}

/** Drops absent players from the top 3 (they cannot take a penalty). */
export function cleanPenaltyTakers(
  takers: string[] | undefined,
  absent: Match['absent'],
): string[] {
  return (takers ?? []).filter((id) => !absent?.[id])
}

export function addStaff(
  staff: StaffMember[] | undefined,
  name: string,
  role: string,
  id: string,
): StaffMember[] {
  const n = name.trim()
  if (!n) return staff ?? []
  return [...(staff ?? []), { id, name: n, role: role.trim() || 'Overig' }]
}

export function updateStaff(
  staff: StaffMember[] | undefined,
  id: string,
  patch: Partial<Pick<StaffMember, 'name' | 'role'>>,
): StaffMember[] {
  return (staff ?? []).map((s) => (s.id === id ? { ...s, ...patch } : s))
}

export function removeStaff(staff: StaffMember[] | undefined, id: string): StaffMember[] {
  return (staff ?? []).filter((s) => s.id !== id)
}
