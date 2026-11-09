-- Zet updated_at altijd op de servertijd bij elke wijziging. De app haalt zo
-- alleen nieuwe of gewijzigde rijen op (sneller, minder data).
-- Uitvoeren NA de vorige bestanden: SQL Editor -> Run.

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists touch_teams on public.teams;
create trigger touch_teams before insert or update on public.teams
  for each row execute function public.touch_updated_at();

drop trigger if exists touch_players on public.players;
create trigger touch_players before insert or update on public.players
  for each row execute function public.touch_updated_at();

drop trigger if exists touch_matches on public.matches;
create trigger touch_matches before insert or update on public.matches
  for each row execute function public.touch_updated_at();

drop trigger if exists touch_actions on public.actions;
create trigger touch_actions before insert or update on public.actions
  for each row execute function public.touch_updated_at();

-- Ook een assistent mag de ledenlijst zien (nodig om een scorer per wedstrijd
-- te kiezen). Wijzigen van rollen blijft alleen voor de coach.
drop policy if exists members_select on public.team_members;
create policy members_select on public.team_members for select using (
  user_id = auth.uid() or public.is_staff(team_id)
);
