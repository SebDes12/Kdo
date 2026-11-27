-- Thème d'affichage choisi par chaque membre (personnel).
-- theme_restore : thème à retrouver après les fêtes quand Noël a été activé depuis la proposition de saison.
alter table public.members
  add column theme text
    check (theme in ('or', 'argent', 'sapin', 'nuit', 'sunset', 'noel')),
  add column theme_restore text
    check (theme_restore in ('or', 'argent', 'sapin', 'nuit', 'sunset', 'noel'));

grant update (theme, theme_restore) on public.members to kdo_user;
