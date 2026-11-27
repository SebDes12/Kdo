-- =====================================================================
-- Photo d'une idée, stockée en base (réduite par le navigateur avant l'envoi).
--   * thumb : vignette ~256 px pour les listes ; data : grande version ~1280 px
--   * visible exactement comme l'idée (RLS) : une idée secrète garde sa photo secrète
--   * plafond global pour ne jamais dépasser le stockage gratuit de Neon
-- Les octets ne sont lus que par la route /idees/[id]/image (jamais dans les listes).
-- =====================================================================

create table public.idea_images (
  idea_id    uuid primary key references public.ideas (id) on delete cascade,
  mime       text not null check (mime in ('image/webp', 'image/jpeg')),
  thumb      bytea not null check (octet_length(thumb) between 1 and 60000),
  data       bytea not null check (octet_length(data) between 1 and 600000),
  updated_at timestamptz not null default now()
);

alter table public.idea_images enable row level security;
grant select, insert, update, delete on public.idea_images to kdo_user;

-- Lecture : seulement si l'idée elle-même est visible (règles RLS de ideas).
create policy idea_images_select on public.idea_images for select to kdo_user
  using (exists (select 1 from public.ideas i where i.id = idea_id));
create policy idea_images_insert on public.idea_images for insert to kdo_user
  with check (public.can_edit_idea(idea_id));
create policy idea_images_update on public.idea_images for update to kdo_user
  using (public.can_edit_idea(idea_id))
  with check (public.can_edit_idea(idea_id));
create policy idea_images_delete on public.idea_images for delete to kdo_user
  using (public.can_edit_idea(idea_id));

-- Plafond global (toutes familles confondues) : 150 Mo.
create or replace function public.idea_images_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  used bigint;
begin
  new.updated_at := now();
  select coalesce(sum(octet_length(data) + octet_length(thumb)), 0) into used
  from public.idea_images where idea_id <> new.idea_id;
  if used + octet_length(new.data) + octet_length(new.thumb) > 150 * 1024 * 1024 then
    raise exception 'Espace photos plein : supprime d''anciennes photos avant d''en ajouter';
  end if;
  return new;
end $$;

create trigger idea_images_guard before insert or update on public.idea_images
  for each row execute function public.idea_images_guard();
