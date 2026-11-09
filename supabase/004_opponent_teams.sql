-- Tegenstander-teams (zonder uitnodigingscode) mag de aanmaker zelf bijwerken
-- (bijvoorbeeld een naamwijziging) bij het synchroniseren.
-- Uitvoeren NA de vorige bestanden: SQL Editor -> Run.

drop policy if exists teams_update_opponent on public.teams;
create policy teams_update_opponent on public.teams for update
  using (created_by = auth.uid() and invite_code is null)
  with check (created_by = auth.uid() and invite_code is null);

-- Spelers van een tegenstander-team: de aanmaker van dat team mag ze beheren
-- (nodig voor de namen in de actielijst).
create or replace function public.is_opponent_creator(t text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from teams
    where id = t and created_by = auth.uid() and invite_code is null
  );
$$;

drop policy if exists players_write_opponent on public.players;
create policy players_write_opponent on public.players for all
  using (public.is_opponent_creator(team_id))
  with check (public.is_opponent_creator(team_id));

drop policy if exists players_select on public.players;
create policy players_select on public.players for select using (
  public.can_see_team(team_id) or public.is_opponent_creator(team_id)
);
