-- Scorer per wedstrijd. Uitvoeren NA schema.sql en 002_scoring_rights.sql.
-- De coach/assistent wijst vooraf een goedgekeurd teamlid aan voor één wedstrijd.

alter table public.matches
  add column if not exists scorer_id uuid references auth.users(id) on delete set null;

-- Mag ik acties van deze wedstrijd schrijven? Coach/assistent, speler met
-- "mag scoren", of de aangewezen scorer van deze wedstrijd (goedgekeurd lid).
create or replace function public.can_edit_match(m text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from matches x
    where x.id = m
      and (
        public.is_scorer(x.home_team_id)
        or public.is_scorer(x.away_team_id)
        or (x.scorer_id = auth.uid()
            and (public.is_member(x.home_team_id, array['coach','assistant','player'])
              or public.is_member(x.away_team_id, array['coach','assistant','player'])))
      )
  );
$$;

-- Wedstrijd bijwerken (klok, periode, keeper): iedereen die de wedstrijd mag
-- scoren. Aanmaken/verwijderen blijft voor coach/assistent.
drop policy if exists matches_update on public.matches;
create policy matches_update on public.matches for update
  using (public.can_edit_match(id)) with check (public.can_edit_match(id));

-- Een gewone scorer mag de wedstrijd zelf niet verplaatsen of een scorer
-- aanwijzen; dat mogen alleen coach/assistent.
create or replace function public.guard_match_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not (public.is_staff(old.home_team_id) or public.is_staff(old.away_team_id)) then
    if new.scorer_id is distinct from old.scorer_id
       or new.home_team_id is distinct from old.home_team_id
       or new.away_team_id is distinct from old.away_team_id then
      raise exception 'alleen coach of assistent mag scorer of teams wijzigen';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists guard_match_update on public.matches;
create trigger guard_match_update before update on public.matches
  for each row execute function public.guard_match_update();
