import { supabase } from './supabase'
import { saveMemberships } from './membershipCache'

export type Role = 'coach' | 'assistant' | 'player'
export type MemberStatus = 'pending' | 'approved'

export interface Membership {
  teamId: string
  teamName: string
  role: Role
  status: MemberStatus
  canScore: boolean
  inviteCode: string | null
  joinOpen: boolean
}

export interface Member {
  userId: string
  name: string
  role: Role
  status: MemberStatus
  playerId: string | null
  canScore: boolean
}

function client() {
  if (!supabase) throw new Error('Online functies zijn niet ingesteld')
  return supabase
}

function fail(error: { message: string } | null) {
  if (error) throw new Error(error.message)
}

/** My own memberships, with the team info I am allowed to see. */
export async function myMemberships(): Promise<Membership[]> {
  const sb = client()
  // Local session (no network round trip), so this also works for the offline check.
  const { data: sessionData } = await sb.auth.getSession()
  const uid = sessionData.session?.user.id
  if (!uid) return []
  const { data: rows, error } = await sb
    .from('team_members')
    .select('team_id, role, status, can_score')
    .eq('user_id', uid)
  fail(error)
  const ids = (rows ?? []).map((r) => r.team_id as string)
  if (ids.length === 0) {
    saveMemberships(uid, [])
    return []
  }
  // Pending members cannot read the team yet; fall back to a placeholder name.
  const { data: teams, error: e2 } = await sb
    .from('teams')
    .select('id, name, invite_code, join_open')
    .in('id', ids)
  fail(e2)
  const byId = new Map((teams ?? []).map((t) => [t.id as string, t]))
  const list = (rows ?? []).map((r) => {
    const t = byId.get(r.team_id as string)
    return {
      teamId: r.team_id as string,
      teamName: (t?.name as string | undefined) ?? 'Team (wacht op goedkeuring)',
      role: r.role as Role,
      status: r.status as MemberStatus,
      canScore: Boolean(r.can_score),
      inviteCode: (t?.invite_code as string | null | undefined) ?? null,
      joinOpen: (t?.join_open as boolean | undefined) ?? true,
    }
  }) satisfies Membership[]
  saveMemberships(uid, list)
  return list
}

/** Put a team online with me as coach. Reuses the local team id so data can sync later. */
export async function createTeam(id: string, name: string): Promise<string> {
  const { data, error } = await client().rpc('create_team', { p_id: id, p_name: name })
  fail(error)
  return data as string
}

/** Player asks to join with an invite code; stays pending until a coach approves. */
export async function joinTeam(code: string): Promise<string> {
  const { data, error } = await client().rpc('join_team', { p_code: code })
  fail(error)
  return data as string
}

export async function listMembers(teamId: string): Promise<Member[]> {
  const sb = client()
  const { data: rows, error } = await sb
    .from('team_members')
    .select('user_id, role, status, player_id, can_score')
    .eq('team_id', teamId)
  fail(error)
  const ids = (rows ?? []).map((r) => r.user_id as string)
  const { data: profiles } = ids.length
    ? await sb.from('profiles').select('id, display_name').in('id', ids)
    : { data: [] }
  const names = new Map((profiles ?? []).map((p) => [p.id as string, p.display_name as string]))
  return (rows ?? []).map((r) => ({
    userId: r.user_id as string,
    name: names.get(r.user_id as string) || 'Onbekend',
    role: r.role as Role,
    status: r.status as MemberStatus,
    playerId: (r.player_id as string | null) ?? null,
    canScore: Boolean(r.can_score),
  }))
}

export async function setMember(
  teamId: string,
  userId: string,
  patch: { role?: Role; status?: MemberStatus; can_score?: boolean },
) {
  const { error } = await client()
    .from('team_members')
    .update(patch)
    .eq('team_id', teamId)
    .eq('user_id', userId)
  fail(error)
}

export async function removeMember(teamId: string, userId: string) {
  const { error } = await client()
    .from('team_members')
    .delete()
    .eq('team_id', teamId)
    .eq('user_id', userId)
  fail(error)
}

export async function setJoinOpen(teamId: string, open: boolean) {
  const { error } = await client().from('teams').update({ join_open: open }).eq('id', teamId)
  fail(error)
}
