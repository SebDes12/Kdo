-- Une invitation peut ajouter la personne à plusieurs groupes.

create table public.invitation_groups (
  token    text not null references public.invitations (token) on delete cascade,
  group_id uuid not null references public.groups (id) on delete cascade,
  primary key (token, group_id)
);

-- Reprise des invitations existantes (un seul groupe)
insert into public.invitation_groups (token, group_id)
  select token, group_id from public.invitations where group_id is not null;

drop policy invitations_insert on public.invitations;
alter table public.invitations drop column group_id;

create policy invitations_insert on public.invitations for insert to kdo_user
  with check (public.current_is_adult() and created_by = public.current_member_id());

alter table public.invitation_groups enable row level security;
revoke all on public.invitation_groups from public, kdo_user;
grant select, insert on public.invitation_groups to kdo_user;

-- On ne voit et n'ajoute des groupes qu'à ses propres invitations,
-- et seulement des groupes dont on est membre.
create policy invitation_groups_select on public.invitation_groups for select to kdo_user
  using (exists (select 1 from public.invitations i
                 where i.token = invitation_groups.token and i.created_by = public.current_member_id()));
create policy invitation_groups_insert on public.invitation_groups for insert to kdo_user
  with check (
    exists (select 1 from public.invitations i
            where i.token = invitation_groups.token and i.created_by = public.current_member_id())
    and exists (select 1 from public.group_members gm
                where gm.group_id = invitation_groups.group_id and gm.member_id = public.current_member_id())
  );
