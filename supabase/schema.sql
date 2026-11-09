-- Backhand: database + rechten (Supabase / Postgres).
-- Uitvoeren in Supabase: SQL Editor -> New query -> plakken -> Run.
-- Veilig om opnieuw te draaien (drop policy if exists / create or replace).

-- ---------------------------------------------------------------- tabellen
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.teams (
  id text primary key,
  name text not null,
  invite_code text unique,                 -- null = geen eigen team (tegenstander)
  join_open boolean not null default true, -- coach kan aanmelden dichtzetten
  created_by uuid references auth.users(id),
  data jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  deleted boolean not null default false
);

-- Wie hoort bij welk team, met welke rol, en is die goedgekeurd.
create table if not exists public.team_members (
  team_id text not null references public.teams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('coach','assistant','player')),
  status text not null default 'pending' check (status in ('pending','approved')),
  player_id text,                           -- koppeling met spelersrij (door coach)
  created_at timestamptz not null default now(),
  primary key (team_id, user_id)
);

create table if not exists public.players (
  id text primary key,
  team_id text not null references public.teams(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  deleted boolean not null default false
);

create table if not exists public.matches (
  id text primary key,
  home_team_id text not null references public.teams(id) on delete cascade,
  away_team_id text not null references public.teams(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  deleted boolean not null default false
);

create table if not exists public.actions (
  id text primary key,
  match_id text not null references public.matches(id) on delete cascade,
  team_id text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  deleted boolean not null default false
);

create index if not exists players_team on public.players(team_id);
create index if not exists matches_home on public.matches(home_team_id);
create index if not exists matches_away on public.matches(away_team_id);
create index if not exists actions_match on public.actions(match_id);
create index if not exists members_user on public.team_members(user_id);

-- ---------------------------------------------------------- hulpfuncties
-- security definer: lezen team_members zonder RLS-lus.
create or replace function public.is_member(t text, roles text[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from team_members
    where team_id = t and user_id = auth.uid()
      and status = 'approved' and role = any(roles)
  );
$$;

create or replace function public.is_staff(t text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_member(t, array['coach','assistant']);
$$;

create or replace function public.is_coach(t text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_member(t, array['coach']);
$$;

-- Mag ik dit team zien? Eigen team, of tegenstander in een wedstrijd van mijn team.
create or replace function public.can_see_team(t text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_member(t, array['coach','assistant','player'])
  or exists (
    select 1 from matches m
    where not m.deleted
      and ((m.home_team_id = t and public.is_member(m.away_team_id, array['coach','assistant','player']))
        or (m.away_team_id = t and public.is_member(m.home_team_id, array['coach','assistant','player'])))
  );
$$;

create or replace function public.can_see_match(m text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from matches x
    where x.id = m
      and (public.is_member(x.home_team_id, array['coach','assistant','player'])
        or public.is_member(x.away_team_id, array['coach','assistant','player']))
  );
$$;

create or replace function public.can_edit_match(m text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from matches x
    where x.id = m
      and (public.is_staff(x.home_team_id) or public.is_staff(x.away_team_id))
  );
$$;

-- ------------------------------------------------------------ functies (RPC)
-- Profiel automatisch aanmaken bij eerste login.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)))
  on conflict do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Coach maakt eigen team: team + goedgekeurde coach-rol + uitnodigingscode.
create or replace function public.create_team(p_id text, p_name text)
returns text language plpgsql security definer set search_path = public as $$
declare code text;
begin
  if auth.uid() is null then raise exception 'niet ingelogd'; end if;
  code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
  insert into teams (id, name, invite_code, created_by) values (p_id, p_name, code, auth.uid());
  insert into team_members (team_id, user_id, role, status)
  values (p_id, auth.uid(), 'coach', 'approved');
  return code;
end $$;

-- Speler meldt zich aan met code. Komt op 'pending' tot een coach goedkeurt.
create or replace function public.join_team(p_code text)
returns text language plpgsql security definer set search_path = public as $$
declare t teams;
begin
  if auth.uid() is null then raise exception 'niet ingelogd'; end if;
  select * into t from teams where invite_code = upper(trim(p_code)) and not deleted;
  if not found or not t.join_open then raise exception 'ongeldige of gesloten code'; end if;
  insert into team_members (team_id, user_id, role, status)
  values (t.id, auth.uid(), 'player', 'pending')
  on conflict (team_id, user_id) do nothing;
  return t.name;
end $$;

-- ------------------------------------------------------------------- RLS
alter table public.profiles     enable row level security;
alter table public.teams        enable row level security;
alter table public.team_members enable row level security;
alter table public.players      enable row level security;
alter table public.matches      enable row level security;
alter table public.actions      enable row level security;

-- profiles: eigen profiel; teamgenoten zien elkaars naam.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select using (
  id = auth.uid()
  or exists (
    select 1 from team_members a join team_members b on a.team_id = b.team_id
    where a.user_id = auth.uid() and a.status = 'approved' and b.user_id = profiles.id
  )
);
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update using (id = auth.uid());

-- teams
drop policy if exists teams_select on public.teams;
create policy teams_select on public.teams for select using (
  public.can_see_team(id) or created_by = auth.uid()
);
drop policy if exists teams_update on public.teams;
create policy teams_update on public.teams for update using (public.is_coach(id));
drop policy if exists teams_delete on public.teams;
create policy teams_delete on public.teams for delete using (public.is_coach(id));
-- Tegenstander-teams (zonder code) mag elke ingelogde gebruiker aanmaken.
drop policy if exists teams_insert_opponent on public.teams;
create policy teams_insert_opponent on public.teams for insert
  with check (auth.uid() is not null and invite_code is null and created_by = auth.uid());

-- team_members: eigen rij, of alle rijen van teams waar ik coach ben.
drop policy if exists members_select on public.team_members;
create policy members_select on public.team_members for select using (
  user_id = auth.uid() or public.is_coach(team_id)
);
drop policy if exists members_update on public.team_members;
create policy members_update on public.team_members for update using (public.is_coach(team_id));
drop policy if exists members_delete on public.team_members;
create policy members_delete on public.team_members for delete using (
  public.is_coach(team_id) or user_id = auth.uid()
);
-- Geen insert-policy: alleen via create_team() / join_team().

-- players
drop policy if exists players_select on public.players;
create policy players_select on public.players for select using (public.can_see_team(team_id));
drop policy if exists players_write on public.players;
create policy players_write on public.players for all
  using (public.is_staff(team_id)) with check (public.is_staff(team_id));

-- matches
drop policy if exists matches_select on public.matches;
create policy matches_select on public.matches for select using (
  public.is_member(home_team_id, array['coach','assistant','player'])
  or public.is_member(away_team_id, array['coach','assistant','player'])
);
drop policy if exists matches_write on public.matches;
create policy matches_write on public.matches for all
  using (public.is_staff(home_team_id) or public.is_staff(away_team_id))
  with check (public.is_staff(home_team_id) or public.is_staff(away_team_id));

-- actions
drop policy if exists actions_select on public.actions;
create policy actions_select on public.actions for select using (public.can_see_match(match_id));
drop policy if exists actions_write on public.actions;
create policy actions_write on public.actions for all
  using (public.can_edit_match(match_id)) with check (public.can_edit_match(match_id));

grant execute on function public.create_team(text, text) to authenticated;
grant execute on function public.join_team(text) to authenticated;
