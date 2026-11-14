-- Teams verwijderen: de aanmaker van een tegenstander-team (zonder code) mag
-- het team zelf verwijderen. Een eigen team (met code) mag alleen de coach
-- verwijderen; dat staat al in schema.sql (teams_delete).
-- Spelers, wedstrijden en acties verdwijnen mee via "on delete cascade".
-- Uitvoeren NA de vorige bestanden: SQL Editor -> Run.

drop policy if exists teams_delete_opponent on public.teams;
create policy teams_delete_opponent on public.teams for delete
  using (created_by = auth.uid() and invite_code is null);
