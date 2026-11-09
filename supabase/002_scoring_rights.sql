-- Wie mag live scoren? Coach en assistent altijd; een speler alleen als de
-- coach dat aanzet ("can_score"). Uitvoeren in Supabase: SQL Editor -> Run.
-- Eerst schema.sql, daarna dit bestand.

alter table public.team_members
  add column if not exists can_score boolean not null default false;

create or replace function public.is_scorer(t text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from team_members
    where team_id = t and user_id = auth.uid() and status = 'approved'
      and (role in ('coach','assistant') or can_score)
  );
$$;

-- Acties (de live statistieken) en wedstrijd-voortgang: alleen scorers.
create or replace function public.can_edit_match(m text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from matches x
    where x.id = m
      and (public.is_scorer(x.home_team_id) or public.is_scorer(x.away_team_id))
  );
$$;

-- Wedstrijden: aanmaken/verwijderen = coach of assistent, bijwerken (klok,
-- periode, keeper) = elke scorer.
drop policy if exists matches_write on public.matches;
drop policy if exists matches_insert on public.matches;
drop policy if exists matches_update on public.matches;
drop policy if exists matches_delete on public.matches;
create policy matches_insert on public.matches for insert
  with check (public.is_staff(home_team_id) or public.is_staff(away_team_id));
create policy matches_update on public.matches for update
  using (public.is_scorer(home_team_id) or public.is_scorer(away_team_id))
  with check (public.is_scorer(home_team_id) or public.is_scorer(away_team_id));
create policy matches_delete on public.matches for delete
  using (public.is_staff(home_team_id) or public.is_staff(away_team_id));
