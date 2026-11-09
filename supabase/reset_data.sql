-- WIST AL DE ONLINE DATA: teams, leden, spelers, wedstrijden en acties.
-- Accounts (inloggen) blijven bestaan. Dit kan niet ongedaan gemaakt worden.
-- Uitvoeren in Supabase: SQL Editor -> New query -> plakken -> Run.

delete from public.actions;
delete from public.matches;
delete from public.players;
delete from public.team_members;
delete from public.teams;
