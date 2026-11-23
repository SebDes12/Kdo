-- =====================================================================
-- Kdo : schéma initial
-- Règle absolue : le bénéficiaire d'une idée ne voit jamais
--   * l'état « choisi » de ses idées, ni les participants, ni les %
--   * les idées suggérées en secret par d'autres
-- Ces règles sont appliquées ici, par la sécurité au niveau des lignes (RLS).
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------

-- Un membre de la famille. Un enfant peut ne pas avoir de compte de connexion.
create table public.members (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid unique references auth.users (id) on delete set null,
  display_name text not null check (length(btrim(display_name)) between 1 and 60),
  is_child     boolean not null default false,
  login        text unique check (login ~ '^[a-z0-9][a-z0-9._-]{1,30}$'),
  created_at   timestamptz not null default now()
);

-- Parents gestionnaires d'un enfant (plusieurs parents possibles).
create table public.parent_links (
  parent_id uuid not null references public.members (id) on delete cascade,
  child_id  uuid not null references public.members (id) on delete cascade,
  primary key (parent_id, child_id),
  check (parent_id <> child_id)
);

create table public.groups (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(btrim(name)) between 1 and 60),
  created_by uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.group_members (
  group_id  uuid not null references public.groups (id) on delete cascade,
  member_id uuid not null references public.members (id) on delete cascade,
  primary key (group_id, member_id)
);

-- Qui voit la liste de owner_id : un groupe OU une personne.
create table public.list_shares (
  id        uuid primary key default gen_random_uuid(),
  owner_id  uuid not null references public.members (id) on delete cascade,
  group_id  uuid references public.groups (id) on delete cascade,
  member_id uuid references public.members (id) on delete cascade,
  check ((group_id is null) <> (member_id is null)),
  check (member_id is null or member_id <> owner_id)
);
create unique index list_shares_group_uniq  on public.list_shares (owner_id, group_id)  where group_id is not null;
create unique index list_shares_member_uniq on public.list_shares (owner_id, member_id) where member_id is not null;

create table public.events (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(btrim(name)) between 1 and 80),
  event_date date not null,
  created_by uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.event_beneficiaries (
  event_id  uuid not null references public.events (id) on delete cascade,
  member_id uuid not null references public.members (id) on delete cascade,
  primary key (event_id, member_id)
);

create table public.ideas (
  id             uuid primary key default gen_random_uuid(),
  beneficiary_id uuid not null references public.members (id) on delete cascade,
  event_id       uuid references public.events (id) on delete set null,
  title          text not null check (length(btrim(title)) between 1 and 200),
  description    text check (length(description) <= 4000),
  price_cents    integer check (price_cents >= 0),
  priority       smallint not null default 0 check (priority between 0 and 3),
  image_url      text check (image_url ~* '^https?://'),
  -- Idée suggérée par quelqu'un d'autre : invisible pour le bénéficiaire.
  is_secret      boolean not null default false,
  created_by     uuid references public.members (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index ideas_beneficiary_idx on public.ideas (beneficiary_id);
create index ideas_event_idx on public.ideas (event_id);

create table public.idea_links (
  id       uuid primary key default gen_random_uuid(),
  idea_id  uuid not null references public.ideas (id) on delete cascade,
  url      text not null check (url ~* '^https?://' and length(url) <= 2000),
  position smallint not null default 0
);
create index idea_links_idea_idx on public.idea_links (idea_id);

-- Participation d'un membre à une idée, pour un événement donné.
-- Quand une idée est reportée sur un autre événement, elle repart à 0 %
-- et les participations passées restent dans l'historique.
create table public.contributions (
  idea_id    uuid not null references public.ideas (id) on delete cascade,
  event_id   uuid not null references public.events (id) on delete cascade,
  member_id  uuid not null references public.members (id) on delete cascade,
  percent    smallint not null check (percent between 1 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (idea_id, event_id, member_id)
);
create index contributions_member_idx on public.contributions (member_id);

create table public.invitations (
  token      text primary key default encode(extensions.gen_random_bytes(18), 'hex'),
  created_by uuid not null references public.members (id) on delete cascade,
  group_id   uuid references public.groups (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '14 days',
  used_at    timestamptz,
  used_by    uuid references public.members (id) on delete set null
);

-- ---------------------------------------------------------------------
-- Fonctions d'aide (security definer : elles lisent sans RLS,
-- ce qui évite les récursions entre politiques)
-- ---------------------------------------------------------------------

create or replace function public.current_member_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.members where user_id = auth.uid()
$$;

create or replace function public.current_is_adult()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select not is_child from public.members where user_id = auth.uid()), false)
$$;

create or replace function public.is_parent_of(child uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.parent_links
    where parent_id = public.current_member_id() and child_id = child
  )
$$;

-- Peut voir la liste (en tant que personne qui offre, ou la sienne).
create or replace function public.can_view_list(owner uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select owner = public.current_member_id()
      or public.is_parent_of(owner)
      or exists (
        select 1 from public.list_shares s
        where s.owner_id = owner
          and (
            s.member_id = public.current_member_id()
            or s.group_id in (select gm.group_id from public.group_members gm
                              where gm.member_id = public.current_member_id())
          )
      )
$$;

-- Peut ajouter / modifier les idées « officielles » d'une liste.
create or replace function public.can_manage_list(owner uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select owner = public.current_member_id() or public.is_parent_of(owner)
$$;

-- Peut régler les paramètres d'un membre (visibilité, etc.) :
-- un adulte pour lui-même, un parent pour son enfant.
create or replace function public.can_admin_member(m uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select (m = public.current_member_id() and public.current_is_adult())
      or public.is_parent_of(m)
$$;

create or replace function public.event_is_active(e uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.events where id = e and event_date >= current_date)
$$;

create or replace function public.is_event_beneficiary(e uuid, m uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.event_beneficiaries where event_id = e and member_id = m)
$$;

create or replace function public.can_view_event(e uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.events ev where ev.id = e and ev.created_by = public.current_member_id())
      or exists (
        select 1 from public.event_beneficiaries b
        where b.event_id = e and public.can_view_list(b.member_id)
      )
$$;

-- Peut voir les participations d'une idée : il faut voir la liste
-- et NE PAS être le bénéficiaire. C'est le cœur de l'effet surprise.
create or replace function public.can_see_contributions(i uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.ideas
    where id = i
      and beneficiary_id <> public.current_member_id()
      and public.can_view_list(beneficiary_id)
  )
$$;

create or replace function public.can_edit_idea(i uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.ideas d
    where d.id = i
      and (
        (d.beneficiary_id = public.current_member_id() and not d.is_secret)
        or public.is_parent_of(d.beneficiary_id)
        or (d.is_secret and d.created_by = public.current_member_id()
            and public.can_view_list(d.beneficiary_id))
      )
  )
$$;

-- ---------------------------------------------------------------------
-- Déclencheurs
-- ---------------------------------------------------------------------

create or replace function public.ideas_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    if new.beneficiary_id <> old.beneficiary_id or new.created_by is distinct from old.created_by then
      raise exception 'Le bénéficiaire et l''auteur d''une idée ne peuvent pas changer';
    end if;
    -- Une idée ne change d'événement que si elle était en réserve
    -- ou rattachée à un événement passé (report).
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
    if not public.is_event_beneficiary(new.event_id, new.beneficiary_id) then
      raise exception 'Cette personne n''est pas bénéficiaire de l''événement';
    end if;
  end if;
  return new;
end $$;

create trigger ideas_guard before insert or update on public.ideas
for each row execute function public.ideas_guard();

-- Le total des participations ne dépasse jamais 100 %.
create or replace function public.contributions_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  total int;
begin
  perform pg_advisory_xact_lock(hashtext(new.idea_id::text || new.event_id::text));
  select coalesce(sum(percent), 0) into total
  from public.contributions
  where idea_id = new.idea_id and event_id = new.event_id
    and member_id <> new.member_id;
  if total + new.percent > 100 then
    raise exception 'Il ne reste que % %% sur cette idée', 100 - total
      using errcode = 'check_violation';
  end if;
  new.updated_at := now();
  return new;
end $$;

create trigger contributions_guard before insert or update on public.contributions
for each row execute function public.contributions_guard();

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------

alter table public.members             enable row level security;
alter table public.parent_links        enable row level security;
alter table public.groups              enable row level security;
alter table public.group_members       enable row level security;
alter table public.list_shares         enable row level security;
alter table public.events              enable row level security;
alter table public.event_beneficiaries enable row level security;
alter table public.ideas               enable row level security;
alter table public.idea_links          enable row level security;
alter table public.contributions       enable row level security;
alter table public.invitations         enable row level security;

revoke all on all tables in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, public;
grant execute on all functions in schema public to authenticated;

-- members : annuaire de la famille, lecture pour tous les membres.
grant select on public.members to authenticated;
grant update (display_name) on public.members to authenticated;
create policy members_select on public.members for select to authenticated
  using (public.current_member_id() is not null);
create policy members_update on public.members for update to authenticated
  using (public.can_admin_member(id) or id = public.current_member_id())
  with check (public.can_admin_member(id) or id = public.current_member_id());

-- parent_links : lecture seule (modifs via fonctions dédiées).
grant select on public.parent_links to authenticated;
create policy parent_links_select on public.parent_links for select to authenticated
  using (public.current_member_id() is not null);

-- groups
grant select, insert, update, delete on public.groups to authenticated;
create policy groups_select on public.groups for select to authenticated
  using (public.current_member_id() is not null);
create policy groups_insert on public.groups for insert to authenticated
  with check (public.current_is_adult() and created_by = public.current_member_id());
create policy groups_update on public.groups for update to authenticated
  using (created_by = public.current_member_id());
create policy groups_delete on public.groups for delete to authenticated
  using (created_by = public.current_member_id());

-- group_members : un membre du groupe (adulte) ou son créateur peut ajouter ;
-- on peut retirer quelqu'un si on a créé le groupe, ou se retirer soi-même.
grant select, insert, delete on public.group_members to authenticated;
create policy group_members_select on public.group_members for select to authenticated
  using (public.current_member_id() is not null);
create policy group_members_insert on public.group_members for insert to authenticated
  with check (
    public.current_is_adult() and (
      exists (select 1 from public.groups g where g.id = group_id and g.created_by = public.current_member_id())
      or exists (select 1 from public.group_members gm where gm.group_id = group_members.group_id
                 and gm.member_id = public.current_member_id())
    )
  );
create policy group_members_delete on public.group_members for delete to authenticated
  using (
    member_id = public.current_member_id()
    or exists (select 1 from public.groups g where g.id = group_id and g.created_by = public.current_member_id())
  );

-- list_shares : réglée par l'adulte lui-même ou par le parent de l'enfant.
grant select, insert, delete on public.list_shares to authenticated;
create policy list_shares_select on public.list_shares for select to authenticated
  using (public.can_manage_list(owner_id));
create policy list_shares_insert on public.list_shares for insert to authenticated
  with check (public.can_admin_member(owner_id));
create policy list_shares_delete on public.list_shares for delete to authenticated
  using (public.can_admin_member(owner_id));

-- events
grant select, insert, update, delete on public.events to authenticated;
create policy events_select on public.events for select to authenticated
  using (created_by = public.current_member_id() or public.can_view_event(id));
create policy events_insert on public.events for insert to authenticated
  with check (public.current_is_adult() and created_by = public.current_member_id());
create policy events_update on public.events for update to authenticated
  using (created_by = public.current_member_id());
create policy events_delete on public.events for delete to authenticated
  using (created_by = public.current_member_id());

grant select, insert, delete on public.event_beneficiaries to authenticated;
create policy event_beneficiaries_select on public.event_beneficiaries for select to authenticated
  using (public.can_view_event(event_id));
create policy event_beneficiaries_insert on public.event_beneficiaries for insert to authenticated
  with check (exists (select 1 from public.events e where e.id = event_id and e.created_by = public.current_member_id()));
create policy event_beneficiaries_delete on public.event_beneficiaries for delete to authenticated
  using (exists (select 1 from public.events e where e.id = event_id and e.created_by = public.current_member_id()));

-- ideas
grant select, insert, update, delete on public.ideas to authenticated;
create policy ideas_select on public.ideas for select to authenticated
  using (
    case when beneficiary_id = public.current_member_id()
      then not is_secret                       -- ses propres idées, jamais les secrètes
      else public.can_view_list(beneficiary_id)
    end
  );
create policy ideas_insert on public.ideas for insert to authenticated
  with check (
    created_by = public.current_member_id()
    and case
      when beneficiary_id = public.current_member_id() then not is_secret
      when public.is_parent_of(beneficiary_id) then true
      else is_secret and public.can_view_list(beneficiary_id)
    end
  );
create policy ideas_update on public.ideas for update to authenticated
  using (public.can_edit_idea(id))
  with check (
    case
      when beneficiary_id = public.current_member_id() then not is_secret
      when public.is_parent_of(beneficiary_id) then true
      else is_secret
    end
  );
create policy ideas_delete on public.ideas for delete to authenticated
  using (public.can_edit_idea(id));

-- idea_links : suivent la visibilité de l'idée (RLS de ideas appliquée).
grant select, insert, update, delete on public.idea_links to authenticated;
create policy idea_links_select on public.idea_links for select to authenticated
  using (exists (select 1 from public.ideas i where i.id = idea_id));
create policy idea_links_write on public.idea_links for all to authenticated
  using (public.can_edit_idea(idea_id))
  with check (public.can_edit_idea(idea_id));

-- contributions : jamais visibles par le bénéficiaire.
grant select, insert, update, delete on public.contributions to authenticated;
create policy contributions_select on public.contributions for select to authenticated
  using (public.can_see_contributions(idea_id));
create policy contributions_insert on public.contributions for insert to authenticated
  with check (
    member_id = public.current_member_id()
    and public.can_see_contributions(idea_id)
    and public.event_is_active(event_id)
    and exists (select 1 from public.ideas i where i.id = idea_id and i.event_id = contributions.event_id)
  );
create policy contributions_update on public.contributions for update to authenticated
  using (member_id = public.current_member_id() and public.event_is_active(event_id))
  with check (member_id = public.current_member_id() and public.event_is_active(event_id));
create policy contributions_delete on public.contributions for delete to authenticated
  using (member_id = public.current_member_id() and public.event_is_active(event_id));

-- invitations : chacun voit et gère les siennes. La consommation se fait
-- côté serveur avec la clé service_role.
grant select, insert, delete on public.invitations to authenticated;
create policy invitations_select on public.invitations for select to authenticated
  using (created_by = public.current_member_id());
create policy invitations_insert on public.invitations for insert to authenticated
  with check (public.current_is_adult() and created_by = public.current_member_id()
              and (group_id is null or exists (select 1 from public.group_members gm
                   where gm.group_id = invitations.group_id and gm.member_id = public.current_member_id())));
create policy invitations_delete on public.invitations for delete to authenticated
  using (created_by = public.current_member_id());

-- ---------------------------------------------------------------------
-- Fonctions métier appelées par l'application
-- ---------------------------------------------------------------------

-- Crée un groupe et y ajoute son créateur.
create or replace function public.create_group(group_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  me uuid := public.current_member_id();
  gid uuid;
begin
  if not public.current_is_adult() then raise exception 'Réservé aux adultes'; end if;
  insert into public.groups (name, created_by) values (btrim(group_name), me) returning id into gid;
  insert into public.group_members (group_id, member_id) values (gid, me);
  return gid;
end $$;

-- Crée un enfant rattaché au parent courant.
create or replace function public.create_child(child_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  me uuid := public.current_member_id();
  cid uuid;
begin
  if not public.current_is_adult() then raise exception 'Réservé aux adultes'; end if;
  insert into public.members (display_name, is_child) values (btrim(child_name), true) returning id into cid;
  insert into public.parent_links (parent_id, child_id) values (me, cid);
  return cid;
end $$;

-- Ajoute un autre adulte comme parent gestionnaire de l'enfant.
create or replace function public.add_coparent(child uuid, parent uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_parent_of(child) then raise exception 'Vous n''êtes pas parent de cet enfant'; end if;
  if not exists (select 1 from public.members where id = parent and not is_child) then
    raise exception 'Un parent doit être un adulte';
  end if;
  insert into public.parent_links (parent_id, child_id) values (parent, child) on conflict do nothing;
end $$;

create or replace function public.remove_coparent(child uuid, parent uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_parent_of(child) then raise exception 'Vous n''êtes pas parent de cet enfant'; end if;
  if (select count(*) from public.parent_links where child_id = child) <= 1 then
    raise exception 'Un enfant doit garder au moins un parent';
  end if;
  delete from public.parent_links where child_id = child and parent_id = parent;
end $$;

-- Émancipation : l'enfant devient adulte et gère seul sa liste.
create or replace function public.emancipate_child(child uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_parent_of(child) then raise exception 'Vous n''êtes pas parent de cet enfant'; end if;
  if not exists (select 1 from public.members where id = child and user_id is not null) then
    raise exception 'Créez d''abord un identifiant de connexion pour cet enfant';
  end if;
  update public.members set is_child = false where id = child;
  delete from public.parent_links where child_id = child;
end $$;

revoke all on all functions in schema public from anon, public;
grant execute on all functions in schema public to authenticated;
