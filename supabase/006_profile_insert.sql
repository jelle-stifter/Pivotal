-- Eigen naam kiezen: een gebruiker mag zijn eigen profielrij aanmaken/bijwerken
-- (de rij wordt normaal bij het eerste inloggen aangemaakt).
-- Uitvoeren NA de vorige bestanden: SQL Editor -> Run.

drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles for insert
  with check (id = auth.uid());
