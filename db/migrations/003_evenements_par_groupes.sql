-- =====================================================================
-- Événements rattachés à des groupes.
--
-- * Un événement est rattaché à un ou plusieurs groupes : tous leurs
--   membres le voient (y compris ceux qui arrivent plus tard).
-- * Chaque membre de ces groupes peut y rattacher ses idées ; elles sont
--   visibles par tous les membres des groupes de l'événement, sauf par
--   la personne qui reçoit (effet surprise).
-- * Plus de partage personne par personne (list_shares) ni de liste des
--   bénéficiaires (event_beneficiaries) : un enfant voit/est vu selon les
--   groupes dont son parent le fait membre.
-- =====================================================================

create table public.event_groups (
  event_id uuid not null references public.events (id) on delete cascade,
  group_id uuid not null references public.groups (id) on delete cascade,
  primary key (event_id, group_id)
);
create index event_groups_group_idx on public.event_groups (group_id);

-- ---------------------------------------------------------------------
-- Reprise des données existantes
-- ---------------------------------------------------------------------

-- Un événement existant est rattaché aux groupes de son créateur.
insert into public.event_groups (event_id, group_id)
  select e.id, gm.group_id
  from public.events e join public.group_members gm on gm.member_id = e.created_by
  on conflict do nothing;

-- Un enfant rejoint les groupes avec lesquels sa liste était partagée ;
-- à défaut, les groupes de ses parents.
insert into public.group_members (group_id, member_id)
  select s.group_id, s.owner_id
  from public.list_shares s join public.members m on m.id = s.owner_id
  where m.is_child and s.group_id is not null
  on conflict do nothing;
insert into public.group_members (group_id, member_id)
  select distinct gm.group_id, pl.child_id
  from public.parent_links pl
  join public.group_members gm on gm.member_id = pl.parent_id
  where not exists (select 1 from public.group_members x where x.member_id = pl.child_id)
  on conflict do nothing;

-- ---------------------------------------------------------------------
-- Fonctions d'aide
-- ---------------------------------------------------------------------

-- Le membre m fait partie d'au moins un groupe de l'événement e.
create or replace function public.member_in_event(e uuid, m uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.event_groups eg
    join public.group_members gm on gm.group_id = eg.group_id
    where eg.event_id = e and gm.member_id = m
  )
$$;

-- Je fais partie de l'événement (directement).
create or replace function public.is_event_member(e uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.member_in_event(e, public.current_member_id())
$$;

-- Je vois l'événement : je l'ai créé, j'en fais partie, ou l'un de mes enfants en fait partie.
create or replace function public.can_view_event(e uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.events ev where ev.id = e and ev.created_by = public.current_member_id())
      or public.is_event_member(e)
      or exists (select 1 from public.parent_links pl
                 where pl.parent_id = public.current_member_id() and public.member_in_event(e, pl.child_id))
$$;

-- Je vois une idée en tant que personne qui offre (jamais la mienne).
create or replace function public.can_view_idea_as_giver(i uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.ideas d
    where d.id = i
      and d.beneficiary_id <> public.current_member_id()
      and (
        public.is_parent_of(d.beneficiary_id)
        or (d.event_id is not null and public.is_event_member(d.event_id))
        or (d.is_secret and d.created_by = public.current_member_id())
      )
  )
$$;

-- Participations : visibles seulement par ceux qui offrent (cœur de l'effet surprise).
create or replace function public.can_see_contributions(i uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.can_view_idea_as_giver(i)
$$;

create or replace function public.can_edit_idea(i uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.ideas d
    where d.id = i
      and (
        (d.beneficiary_id = public.current_member_id() and not d.is_secret)
        or public.is_parent_of(d.beneficiary_id)
        or (d.is_secret and d.created_by = public.current_member_id())
      )
  )
$$;

-- Une idée rattachée à un événement : l'événement est en cours et la
-- personne qui reçoit fait partie de ses groupes.
create or replace function public.ideas_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    if new.beneficiary_id <> old.beneficiary_id or new.created_by is distinct from old.created_by then
      raise exception 'Le bénéficiaire et l''auteur d''une idée ne peuvent pas changer';
    end if;
    if new.event_id is distinct from old.event_id
       and old.event_id is not null and public.event_is_active(old.event_id) then
      raise exception 'Cette idée est rattachée à un événement en cours';
    end if;
    new.updated_at := now();
  end if;

  if new.event_id is not null then
    if tg_op = 'UPDATE' then
      if new.event_id is not distinct from old.event_id then
        return new;
      end if;
    end if;
    if not public.event_is_active(new.event_id) then
      raise exception 'Cet événement est passé';
    end if;
    if not public.member_in_event(new.event_id, new.beneficiary_id) then
      raise exception 'Cette personne ne fait partie d''aucun groupe de l''événement';
    end if;
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------
-- Politiques
-- ---------------------------------------------------------------------

drop policy ideas_select on public.ideas;
drop policy ideas_insert on public.ideas;

create policy ideas_select on public.ideas for select to kdo_user
  using (
    case when beneficiary_id = public.current_member_id()
      then not is_secret                       -- ses propres idées, jamais les secrètes
      else public.is_parent_of(beneficiary_id)
        or (event_id is not null and public.is_event_member(event_id))
        or (is_secret and created_by = public.current_member_id())
    end
  );

create policy ideas_insert on public.ideas for insert to kdo_user
  with check (
    created_by = public.current_member_id()
    and case
      when beneficiary_id = public.current_member_id() then not is_secret
      when public.is_parent_of(beneficiary_id) then true
      -- suggestion secrète pour quelqu'un d'un événement dont je fais partie
      else is_secret and event_id is not null and public.is_event_member(event_id)
    end
  );

-- Groupes : un parent peut aussi retirer son enfant d'un groupe.
drop policy group_members_delete on public.group_members;
create policy group_members_delete on public.group_members for delete to kdo_user
  using (
    member_id = public.current_member_id()
    or public.is_parent_of(member_id)
    or exists (select 1 from public.groups g where g.id = group_id and g.created_by = public.current_member_id())
  );

alter table public.event_groups enable row level security;
revoke all on public.event_groups from public, kdo_user;
grant select, insert, delete on public.event_groups to kdo_user;
create policy event_groups_select on public.event_groups for select to kdo_user
  using (public.can_view_event(event_id));
-- Le créateur de l'événement le rattache à des groupes dont il est membre.
create policy event_groups_insert on public.event_groups for insert to kdo_user
  with check (
    exists (select 1 from public.events e where e.id = event_id and e.created_by = public.current_member_id())
    and exists (select 1 from public.group_members gm
                where gm.group_id = event_groups.group_id and gm.member_id = public.current_member_id())
  );
create policy event_groups_delete on public.event_groups for delete to kdo_user
  using (exists (select 1 from public.events e where e.id = event_id and e.created_by = public.current_member_id()));

-- ---------------------------------------------------------------------
-- Nettoyage de l'ancien modèle
-- ---------------------------------------------------------------------

drop table public.list_shares;
drop table public.event_beneficiaries;
drop function public.can_view_list(uuid);
drop function public.is_event_beneficiary(uuid, uuid);

revoke all on all functions in schema public from public;
grant execute on all functions in schema public to kdo_user;
