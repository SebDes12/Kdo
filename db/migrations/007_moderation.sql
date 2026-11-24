-- =====================================================================
-- Garde-fous contre les abus :
-- * administrateurs de groupe (le créateur, et ceux qu'il nomme) :
--   ils gèrent les événements du groupe, ses membres et ses réglages ;
-- * réglage par groupe « qui peut créer des événements » ;
-- * corbeille : un événement supprimé est restaurable pendant 30 jours ;
-- * traçabilité : qui a créé / modifié / supprimé un événement.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Administrateurs de groupe
-- ---------------------------------------------------------------------
alter table public.group_members add column is_admin boolean not null default false;

update public.group_members gm set is_admin = true
from public.groups g where g.id = gm.group_id and g.created_by = gm.member_id;
-- Groupe sans administrateur : tous ses membres adultes le deviennent
update public.group_members gm set is_admin = true
from public.members m
where m.id = gm.member_id and not m.is_child
  and not exists (select 1 from public.group_members x where x.group_id = gm.group_id and x.is_admin);

alter table public.groups add column event_creation text not null default 'members'
  check (event_creation in ('members', 'admins'));

create or replace function public.is_group_admin(g uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.group_members
                 where group_id = g and member_id = public.current_member_id() and is_admin)
$$;

create or replace function public.create_group(group_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  me uuid := public.current_member_id();
  gid uuid;
begin
  if not public.current_is_adult() then raise exception 'Réservé aux adultes'; end if;
  insert into public.groups (name, created_by) values (btrim(group_name), me) returning id into gid;
  insert into public.group_members (group_id, member_id, is_admin) values (gid, me, true);
  return gid;
end $$;

-- Nommer / retirer un administrateur (jamais le dernier).
create or replace function public.set_group_admin(g uuid, m uuid, admin boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_group_admin(g) then raise exception 'Réservé aux administrateurs du groupe'; end if;
  if not exists (select 1 from public.group_members gm join public.members x on x.id = gm.member_id
                 where gm.group_id = g and gm.member_id = m and not x.is_child) then
    raise exception 'Seul un adulte membre du groupe peut être administrateur';
  end if;
  if not admin and (select count(*) from public.group_members where group_id = g and is_admin and member_id <> m) = 0 then
    raise exception 'Le groupe doit garder au moins un administrateur';
  end if;
  update public.group_members set is_admin = admin where group_id = g and member_id = m;
end $$;

-- Si le dernier administrateur quitte le groupe, les adultes restants le deviennent.
create or replace function public.group_members_keep_admin()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.group_members where group_id = old.group_id and is_admin) then
    update public.group_members gm set is_admin = true
    from public.members x
    where gm.group_id = old.group_id and x.id = gm.member_id and not x.is_child;
  end if;
  return null;
end $$;
create trigger group_members_keep_admin after delete on public.group_members
for each row execute function public.group_members_keep_admin();

drop policy groups_update on public.groups;
drop policy groups_delete on public.groups;
revoke update on public.groups from kdo_user;
grant update (name, event_creation) on public.groups to kdo_user;
create policy groups_update on public.groups for update to kdo_user
  using (public.is_group_admin(id)) with check (public.is_group_admin(id));
create policy groups_delete on public.groups for delete to kdo_user
  using (public.is_group_admin(id));

drop policy group_members_insert on public.group_members;
create policy group_members_insert on public.group_members for insert to kdo_user
  with check (
    public.current_is_adult()
    and (public.is_group_admin(group_id)
         or exists (select 1 from public.group_members gm where gm.group_id = group_members.group_id
                    and gm.member_id = public.current_member_id()))
    and (not is_admin or public.is_group_admin(group_id))
  );

drop policy group_members_delete on public.group_members;
create policy group_members_delete on public.group_members for delete to kdo_user
  using (
    member_id = public.current_member_id()
    or public.is_parent_of(member_id)
    or public.is_group_admin(group_id)
  );

-- ---------------------------------------------------------------------
-- Événements : gestion, corbeille, traçabilité
-- ---------------------------------------------------------------------
alter table public.events
  add column updated_at timestamptz,
  add column updated_by uuid references public.members (id) on delete set null,
  add column deleted_at timestamptz,
  add column deleted_by uuid references public.members (id) on delete set null;

-- Gérer un événement : son créateur, ou un administrateur d'un de ses groupes.
create or replace function public.can_manage_event(e uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.events where id = e and created_by = public.current_member_id())
      or exists (select 1 from public.event_groups eg where eg.event_id = e and public.is_group_admin(eg.group_id))
$$;

create or replace function public.has_contribution_in_event(e uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.contributions
                 where event_id = e and member_id = public.current_member_id())
$$;

create or replace function public.events_touch()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (new.name, new.event_date, new.end_date) is distinct from (old.name, old.event_date, old.end_date) then
    new.updated_at := now();
    new.updated_by := public.current_member_id();
  end if;
  return new;
end $$;
create trigger events_touch before update on public.events
for each row execute function public.events_touch();

drop policy events_select on public.events;
create policy events_select on public.events for select to kdo_user
  using (
    case when deleted_at is null
      then created_by = public.current_member_id() or public.can_view_event(id)
      -- Dans la corbeille : visible de ceux qui peuvent le restaurer, et de ceux qui y avaient choisi un cadeau
      else public.can_manage_event(id) or public.has_contribution_in_event(id)
    end
  );

drop policy events_update on public.events;
drop policy events_delete on public.events;
revoke update, delete on public.events from kdo_user;
grant update (name, event_date, end_date) on public.events to kdo_user;
create policy events_update on public.events for update to kdo_user
  using (deleted_at is null and public.can_manage_event(id))
  with check (public.can_manage_event(id));

create or replace function public.delete_event(e uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.can_manage_event(e) then raise exception 'Action non autorisée'; end if;
  update public.events set deleted_at = now(), deleted_by = public.current_member_id()
  where id = e and deleted_at is null;
end $$;

create or replace function public.restore_event(e uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.can_manage_event(e) then raise exception 'Action non autorisée'; end if;
  update public.events set deleted_at = null, deleted_by = null
  where id = e and deleted_at > now() - interval '30 days';
  if not found then raise exception 'Cet événement n''est plus dans la corbeille'; end if;
end $$;

-- Effacement définitif après 30 jours de corbeille (les idées repassent en réserve).
create or replace function public.purge_deleted_events()
returns integer language plpgsql security definer set search_path = public as $$
declare
  n integer;
begin
  delete from public.events where deleted_at < now() - interval '30 days';
  get diagnostics n = row_count;
  return n;
end $$;

-- On ne rattache pas une idée à un événement de la corbeille.
create or replace function public.event_accepts_ideas(e uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.events where id = e and deleted_at is null and end_date >= current_date)
$$;

create or replace function public.ideas_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    if new.beneficiary_id <> old.beneficiary_id or new.created_by is distinct from old.created_by then
      raise exception 'Le bénéficiaire et l''auteur d''une idée ne peuvent pas changer';
    end if;
    new.updated_at := now();
    if new.event_id is not distinct from old.event_id or new.deleted_at is not null then
      return new;
    end if;
  end if;

  if new.event_id is not null then
    if not public.event_accepts_ideas(new.event_id) then
      raise exception 'Cet événement est terminé ou supprimé';
    end if;
    if not public.member_in_event(new.event_id, new.beneficiary_id) then
      raise exception 'Cette personne ne fait partie d''aucun groupe de l''événement';
    end if;
  end if;

  if tg_op = 'UPDATE' and old.event_id is not null and new.event_id is not null
     and public.event_is_active(old.event_id) then
    update public.contributions set event_id = new.event_id
    where idea_id = new.id and event_id = old.event_id;
  end if;
  return new;
end $$;

-- Rattacher un groupe : gestionnaire de l'événement, membre du groupe, et
-- le groupe autorise ses membres à créer des événements (ou on en est admin).
drop policy event_groups_insert on public.event_groups;
create policy event_groups_insert on public.event_groups for insert to kdo_user
  with check (
    public.can_manage_event(event_id)
    and exists (select 1 from public.group_members gm
                where gm.group_id = event_groups.group_id and gm.member_id = public.current_member_id())
    and (public.is_group_admin(group_id)
         or exists (select 1 from public.groups g where g.id = group_id and g.event_creation = 'members'))
  );
drop policy event_groups_delete on public.event_groups;
create policy event_groups_delete on public.event_groups for delete to kdo_user
  using (public.can_manage_event(event_id));

revoke all on all functions in schema public from public;
grant execute on all functions in schema public to kdo_user;
