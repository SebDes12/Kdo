-- La visite guidée est montrée une fois à tout le monde, y compris aux membres déjà inscrits.
-- Un déploiement de prévisualisation avait appliqué 011_visite_guidee_cookie.sql (abandonnée),
-- qui supprimait la colonne : on la recrée si besoin, avec son droit de mise à jour.
alter table public.members add column if not exists tour_done boolean not null default false;
grant update (tour_done) on public.members to kdo_user;
update public.members set tour_done = false;
