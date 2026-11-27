-- Visite guidée de l'application, montrée une fois aux nouveaux membres.
-- Les membres déjà inscrits connaissent l'application : on la marque comme vue pour eux.
alter table public.members add column tour_done boolean not null default true;
alter table public.members alter column tour_done set default false;

grant update (tour_done) on public.members to kdo_user;
