-- Lien d'activation pour qu'un enfant se connecte : créé par un parent,
-- envoyé à l'enfant, qui choisit son mot de passe (et son pseudo s'il
-- n'en a pas encore). Usage unique, valable 7 jours ; seule l'empreinte
-- du jeton est stockée.

create table public.login_links (
  token_hash text primary key,
  member_id  uuid not null references public.members (id) on delete cascade,
  created_by uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  used_at    timestamptz
);
alter table public.login_links enable row level security;
revoke all on public.login_links from public, kdo_user;
-- Aucune politique : kdo_user n'y accède que via la fonction ci-dessous.

create or replace function public.create_child_login_link(child uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  raw text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
begin
  if not public.is_parent_of(child) then
    raise exception 'Seul un parent peut créer ce lien';
  end if;
  if not exists (select 1 from public.members where id = child and is_child) then
    raise exception 'Ce lien est réservé aux enfants';
  end if;
  -- Un seul lien valable à la fois par enfant
  update public.login_links set used_at = now() where member_id = child and used_at is null;
  insert into public.login_links (token_hash, member_id, created_by)
    values (encode(sha256(convert_to(raw, 'UTF8')), 'hex'), child, public.current_member_id());
  return raw;
end $$;

revoke all on function public.create_child_login_link(uuid) from public;
grant execute on function public.create_child_login_link(uuid) to kdo_user;
