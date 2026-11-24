-- =====================================================================
-- 1. Un événement a une période (début → fin) : on peut fêter en
--    plusieurs fois. Il reste ouvert jusqu'à sa date de fin.
-- 2. Retirer / déplacer / supprimer une idée est toujours possible, sans
--    rien révéler à la personne qui reçoit, et sans faire perdre une
--    réservation à celui qui l'a choisie :
--    * suppression logique (deleted_at) ; effacement physique 2 jours
--      après la fin de l'événement (sauf idée en réserve jamais choisie :
--      effacée tout de suite) ;
--    * une idée déplacée vers un autre événement en cours emporte ses
--      réservations ; retirée de l'événement, ses réservations restent ;
--    * celui qui a choisi une idée la voit toujours (avec un avertissement).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Période
-- ---------------------------------------------------------------------
alter table public.events add column end_date date;
update public.events set end_date = event_date;
alter table public.events alter column end_date set not null;
alter table public.events add constraint events_period_check check (end_date >= event_date);

-- Sans date de fin, l'événement dure un jour.
create or replace function public.events_default_end()
returns trigger language plpgsql as $$
begin
  new.end_date := coalesce(new.end_date, new.event_date);
  return new;
end $$;
create trigger events_default_end before insert or update on public.events
for each row execute function public.events_default_end();

create or replace function public.event_is_active(e uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.events where id = e and end_date >= current_date)
$$;

-- ---------------------------------------------------------------------
-- Suppression logique
-- ---------------------------------------------------------------------
alter table public.ideas
  add column deleted_at timestamptz,
  add column deleted_by uuid references public.members (id) on delete set null;
create index ideas_deleted_idx on public.ideas (deleted_at) where deleted_at is not null;

create or replace function public.has_my_contribution(i uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.contributions
                 where idea_id = i and member_id = public.current_member_id())
$$;

-- Je vois une idée en tant que personne qui offre (jamais la mienne) :
-- soit je l'ai choisie (même retirée ou supprimée), soit elle est active
-- et visible (enfant, membre de l'événement, ma suggestion).
create or replace function public.can_view_idea_as_giver(i uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.ideas d
    where d.id = i
      and d.beneficiary_id <> public.current_member_id()
      and (
        public.has_my_contribution(d.id)
        or (d.deleted_at is null and (
              public.is_parent_of(d.beneficiary_id)
              or (d.event_id is not null and public.is_event_member(d.event_id))
              or (d.is_secret and d.created_by = public.current_member_id())
            ))
      )
  )
$$;

create or replace function public.can_edit_idea(i uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.ideas d
    where d.id = i
      and d.deleted_at is null
      and (
        (d.beneficiary_id = public.current_member_id() and not d.is_secret)
        or public.is_parent_of(d.beneficiary_id)
        or (d.is_secret and d.created_by = public.current_member_id())
      )
  )
$$;

drop policy ideas_select on public.ideas;
create policy ideas_select on public.ideas for select to kdo_user
  using (
    case when beneficiary_id = public.current_member_id()
      then not is_secret and deleted_at is null   -- ses idées, jamais les secrètes ni les supprimées
      else public.has_my_contribution(id)
        or (deleted_at is null and (
              public.is_parent_of(beneficiary_id)
              or (event_id is not null and public.is_event_member(event_id))
              or (is_secret and created_by = public.current_member_id())
            ))
    end
  );

-- La suppression passe par delete_idea() (logique), plus par DELETE.
drop policy ideas_delete on public.ideas;
revoke delete on public.ideas from kdo_user;

create or replace function public.delete_idea(i uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  d public.ideas;
begin
  if not public.can_edit_idea(i) then raise exception 'Action non autorisée'; end if;
  select * into d from public.ideas where id = i for update;
  if d.event_id is null and not exists (select 1 from public.contributions where idea_id = i) then
    delete from public.ideas where id = i;           -- rien à protéger
  else
    update public.ideas set deleted_at = now(), deleted_by = public.current_member_id() where id = i;
  end if;
end $$;

-- Effacement physique des idées supprimées, 2 jours après la fin de
-- tous les événements concernés (le sien et ceux de ses réservations).
create or replace function public.purge_deleted_ideas()
returns integer language plpgsql security definer set search_path = public as $$
declare
  n integer;
begin
  delete from public.ideas d
  where d.deleted_at is not null
    and not exists (
      select 1 from public.events e
      where (e.id = d.event_id
             or e.id in (select c.event_id from public.contributions c where c.idea_id = d.id))
        and e.end_date + 2 >= current_date
    );
  get diagnostics n = row_count;
  return n;
end $$;

-- ---------------------------------------------------------------------
-- Déplacement libre d'une idée
-- ---------------------------------------------------------------------
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
    if not public.event_is_active(new.event_id) then
      raise exception 'Cet événement est terminé';
    end if;
    if not public.member_in_event(new.event_id, new.beneficiary_id) then
      raise exception 'Cette personne ne fait partie d''aucun groupe de l''événement';
    end if;
  end if;

  -- Déplacée d'un événement en cours vers un autre : les réservations suivent.
  -- (Retirée de l'événement : elles restent ; reportée d'un événement passé : historique.)
  if tg_op = 'UPDATE' and old.event_id is not null and new.event_id is not null
     and public.event_is_active(old.event_id) then
    update public.contributions set event_id = new.event_id
    where idea_id = new.id and event_id = old.event_id;
  end if;
  return new;
end $$;

revoke all on all functions in schema public from public;
grant execute on all functions in schema public to kdo_user;
