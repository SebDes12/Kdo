-- Un parent peut supprimer le profil d'un enfant (par exemple un doublon).
-- Tout ce qui le concerne disparaît : ses idées, ses choix, ses groupes,
-- son identifiant de connexion.

create or replace function public.delete_child(child uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_parent_of(child) then
    raise exception 'Seul un parent peut supprimer cet enfant';
  end if;
  if not exists (select 1 from public.members where id = child and is_child) then
    raise exception 'Seul le profil d''un enfant peut être supprimé';
  end if;
  delete from public.members where id = child;
end $$;

revoke all on function public.delete_child(uuid) from public;
grant execute on function public.delete_child(uuid) to kdo_user;
