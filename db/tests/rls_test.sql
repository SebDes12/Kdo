-- Tests des règles de gestion, en particulier l'effet surprise.
\set ON_ERROR_STOP 1
set client_min_messages = warning;

create schema tests;
grant usage on schema tests to kdo_user;

create function tests.ok(cond boolean, msg text) returns void language plpgsql as $$
begin
  if cond is not true then raise exception 'ÉCHEC : %', msg; end if;
end $$;

create function tests.refused(stmt text, msg text) returns void language plpgsql as $$
begin
  execute stmt;
  raise exception 'ÉCHEC (aurait dû être refusé) : %', msg;
exception when others then
  if sqlerrm like 'ÉCHEC%' then raise; end if;
end $$;

-- Nombre de lignes touchées par un UPDATE/DELETE
create function tests.affected(stmt text) returns int language plpgsql as $$
declare n int;
begin
  execute stmt;
  get diagnostics n = row_count;
  return n;
end $$;

-- Se connecter = positionner l'empreinte d'une session existante.
create function tests.login(u uuid) returns void language sql as $$
  select set_config('app.session', 'session-' || u::text, false);
$$;

grant execute on all functions in schema tests to kdo_user;

-- ---------------------------------------------------------------------
-- Données : papa, maman, mamie, oncle (adultes), Léo (enfant)
-- ---------------------------------------------------------------------
insert into public.members (id, display_name) values
  ('10000000-0000-0000-0000-000000000001', 'Papa'),
  ('10000000-0000-0000-0000-000000000002', 'Maman'),
  ('10000000-0000-0000-0000-000000000003', 'Mamie'),
  ('10000000-0000-0000-0000-000000000004', 'Oncle');
insert into public.accounts (member_id, email, password_hash)
  select id, lower(display_name) || '@test.fr', 'x' from public.members;
insert into public.sessions (token_hash, member_id, expires_at)
  select 'session-' || id, id, now() + interval '1 day' from public.members;
-- Une session expirée pour l'oncle
insert into public.sessions (token_hash, member_id, expires_at)
  values ('expiree', '10000000-0000-0000-0000-000000000004', now() - interval '1 minute');

\set PAPA   '''10000000-0000-0000-0000-000000000001'''
\set MAMAN  '''10000000-0000-0000-0000-000000000002'''
\set MAMIE  '''10000000-0000-0000-0000-000000000003'''
\set ONCLE  '''10000000-0000-0000-0000-000000000004'''
\set INCONNU '''99999999-9999-9999-9999-999999999999'''
\set M_PAPA  '''10000000-0000-0000-0000-000000000001'''
\set M_MAMAN '''10000000-0000-0000-0000-000000000002'''
\set M_MAMIE '''10000000-0000-0000-0000-000000000003'''
\set M_ONCLE '''10000000-0000-0000-0000-000000000004'''

set role kdo_user;

-- Sans session, on ne voit rien
select set_config('app.session', '', false);
select tests.ok((select count(*) from public.members) = 0, 'sans session : aucun membre visible');
select set_config('app.session', 'expiree', false);
select tests.ok((select count(*) from public.members) = 0, 'session expirée : aucun membre visible');
select tests.refused('select * from public.accounts', 'lire les mots de passe');
select tests.refused('select * from public.sessions', 'lire les sessions');

-- Papa crée Léo, ajoute maman comme co-parent, crée le groupe « Famille proche »
select tests.login(:PAPA);
select public.create_child('Léo') as leo \gset
\set M_LEO '''':leo''''
select public.add_coparent(:M_LEO, :M_MAMAN);
select public.create_group('Famille proche') as famille \gset
\set G_FAM '''':famille''''
insert into public.group_members (group_id, member_id) values (:G_FAM, :M_MAMAN), (:G_FAM, :M_MAMIE);
-- Papa partage sa liste avec le groupe ; et celle de Léo avec le groupe
insert into public.list_shares (owner_id, group_id) values (:M_PAPA, :G_FAM), (:M_LEO, :G_FAM);
-- Maman partage sa liste avec le groupe
select tests.login(:MAMAN);
insert into public.list_shares (owner_id, group_id) values (:M_MAMAN, :G_FAM);

-- Léo obtient un identifiant (fait côté serveur, hors kdo_user)
reset role;
update public.members set login = 'leo' where id = :M_LEO;
insert into public.accounts (member_id, password_hash) values (:M_LEO, 'x');
insert into public.sessions (token_hash, member_id, expires_at) values ('session-' || :M_LEO, :M_LEO, now() + interval '1 day');
set role kdo_user;
\set LEO_U :M_LEO

-- Un enfant ne règle pas la visibilité de sa liste
select tests.login(:LEO_U);
select tests.refused(format('insert into public.list_shares (owner_id, member_id) values (%L, %L)', :M_LEO, :M_ONCLE),
  'un enfant partage sa propre liste');
select tests.refused('select public.create_group(''x'')', 'un enfant crée un groupe');

-- Événements : Noël (à venir) pour papa, maman, Léo
select tests.login(:PAPA);
insert into public.events (name, event_date, created_by) values ('Noël', current_date + 30, :M_PAPA) returning id as noel \gset
\set E_NOEL '''':noel''''
insert into public.events (name, event_date, created_by) values ('Anniv passé', current_date - 10, :M_PAPA) returning id as passe \gset
\set E_PASSE '''':passe''''
insert into public.event_beneficiaries (event_id, member_id) values
  (:E_NOEL, :M_PAPA), (:E_NOEL, :M_MAMAN), (:E_NOEL, :M_LEO), (:E_PASSE, :M_LEO);

-- Un enfant ne crée pas d'événement
select tests.login(:LEO_U);
select tests.refused(format('insert into public.events (name, event_date, created_by) values (''x'', current_date, %L)', :M_LEO),
  'un enfant crée un événement');

-- ---------------------------------------------------------------------
-- Idées
-- ---------------------------------------------------------------------
select tests.login(:PAPA);
insert into public.ideas (beneficiary_id, event_id, title, created_by)
  values (:M_PAPA, :E_NOEL, 'Perceuse', :M_PAPA) returning id as i_perceuse \gset
\set I_PERCEUSE '''':i_perceuse''''
insert into public.idea_links (idea_id, url) values (:I_PERCEUSE, 'https://exemple.fr/perceuse');
select tests.refused(format('insert into public.ideas (beneficiary_id, title, is_secret, created_by) values (%L, ''x'', true, %L)', :M_PAPA, :M_PAPA),
  'idée secrète pour soi-même');
select tests.refused(format('insert into public.ideas (beneficiary_id, event_id, title, created_by) values (%L, %L, ''x'', %L)', :M_PAPA, :E_PASSE, :M_PAPA),
  'idée sur un événement passé');
select tests.refused(format('insert into public.ideas (beneficiary_id, event_id, title, created_by) values (%L, %L, ''x'', %L)', :M_MAMIE, :E_NOEL, :M_PAPA),
  'idée pour quelqu''un sans droit');

-- Mamie suggère une idée secrète pour papa ; elle ne peut pas créer d'idée visible
select tests.login(:MAMIE);
insert into public.ideas (beneficiary_id, event_id, title, is_secret, created_by)
  values (:M_PAPA, :E_NOEL, 'Livre surprise', true, :M_MAMIE) returning id as i_livre \gset
\set I_LIVRE '''':i_livre''''
select tests.refused(format('insert into public.ideas (beneficiary_id, title, is_secret, created_by) values (%L, ''x'', false, %L)', :M_PAPA, :M_MAMIE),
  'idée non secrète sur la liste de quelqu''un d''autre');

-- Papa voit sa perceuse et son lien, pas la suggestion secrète
select tests.login(:PAPA);
select tests.ok((select count(*) from public.ideas where beneficiary_id = :M_PAPA) = 1, 'papa voit 1 idée');
select tests.ok((select count(*) from public.idea_links) = 1, 'papa voit le lien');
select tests.ok((select count(*) from public.ideas where id = :I_LIVRE) = 0, 'papa ne voit pas la suggestion secrète');
select tests.ok(tests.affected(format('update public.ideas set title = ''hack'' where id = %L', :I_LIVRE)) = 0,
  'papa ne modifie pas la suggestion secrète');

-- ---------------------------------------------------------------------
-- Participations
-- ---------------------------------------------------------------------
select tests.login(:MAMAN);
select tests.ok((select count(*) from public.ideas where beneficiary_id = :M_PAPA) = 2, 'maman voit les 2 idées de papa');
insert into public.contributions (idea_id, event_id, member_id, percent) values (:I_PERCEUSE, :E_NOEL, :M_MAMAN, 60);

select tests.login(:MAMIE);
select tests.refused(format('insert into public.contributions (idea_id, event_id, member_id, percent) values (%L, %L, %L, 50)', :I_PERCEUSE, :E_NOEL, :M_MAMIE),
  'dépassement de 100 %');
insert into public.contributions (idea_id, event_id, member_id, percent) values (:I_PERCEUSE, :E_NOEL, :M_MAMIE, 40);
select tests.ok((select sum(percent) from public.contributions where idea_id = :I_PERCEUSE) = 100, 'mamie voit 100 %');
select tests.refused(format('insert into public.contributions (idea_id, event_id, member_id, percent) values (%L, %L, %L, 10)', :I_PERCEUSE, :E_NOEL, :M_MAMAN),
  'participer au nom de quelqu''un d''autre');
select tests.ok(tests.affected(format('update public.contributions set percent = 1 where member_id = %L', :M_MAMAN)) = 0,
  'modifier la participation de quelqu''un d''autre');

-- Effet surprise : papa ne voit aucune participation sur ses idées
select tests.login(:PAPA);
select tests.ok((select count(*) from public.contributions) = 0, 'papa ne voit aucune participation');
select tests.refused(format('insert into public.contributions (idea_id, event_id, member_id, percent) values (%L, %L, %L, 1)', :I_PERCEUSE, :E_NOEL, :M_PAPA),
  'participer à sa propre idée');

-- L'oncle n'a pas accès à la liste de papa
select tests.login(:ONCLE);
select tests.ok((select count(*) from public.ideas) = 0, 'oncle ne voit aucune idée');
select tests.ok((select count(*) from public.contributions) = 0, 'oncle ne voit aucune participation');
select tests.ok((select count(*) from public.events) = 0, 'oncle ne voit pas Noël');
select tests.refused(format('insert into public.ideas (beneficiary_id, title, is_secret, created_by) values (%L, ''x'', true, %L)', :M_PAPA, :M_ONCLE),
  'oncle suggère sans accès');

-- Un inconnu (connecté mais pas membre) ne voit rien
select tests.login(:INCONNU);
select tests.ok((select count(*) from public.members) = 0, 'inconnu ne voit pas les membres');

-- ---------------------------------------------------------------------
-- Enfant
-- ---------------------------------------------------------------------
select tests.login(:PAPA);
insert into public.ideas (beneficiary_id, event_id, title, created_by)
  values (:M_LEO, :E_NOEL, 'Lego', :M_PAPA) returning id as i_lego \gset
\set I_LEGO '''':i_lego''''
insert into public.ideas (beneficiary_id, event_id, title, is_secret, created_by)
  values (:M_LEO, :E_NOEL, 'Vélo surprise', true, :M_PAPA) returning id as i_velo \gset
\set I_VELO '''':i_velo''''

select tests.login(:LEO_U);
insert into public.ideas (beneficiary_id, event_id, title, created_by)
  values (:M_LEO, :E_NOEL, 'Doudou', :M_LEO);
select tests.ok((select count(*) from public.ideas where beneficiary_id = :M_LEO) = 2, 'Léo voit Lego + Doudou');
select tests.ok((select count(*) from public.ideas where id = :I_VELO) = 0, 'Léo ne voit pas le vélo surprise');

select tests.login(:MAMIE);
insert into public.contributions (idea_id, event_id, member_id, percent) values (:I_LEGO, :E_NOEL, :M_MAMIE, 100);

select tests.login(:LEO_U);
select tests.ok((select count(*) from public.contributions) = 0, 'Léo ne voit aucune participation');

select tests.login(:MAMAN);
select tests.ok((select count(*) from public.contributions where idea_id = :I_LEGO) = 1, 'maman (parent) voit la participation de mamie');
select tests.ok((select count(*) from public.ideas where beneficiary_id = :M_LEO) = 3, 'maman voit les 3 idées de Léo');

-- ---------------------------------------------------------------------
-- Report d'idées
-- ---------------------------------------------------------------------
select tests.login(:PAPA);
insert into public.ideas (beneficiary_id, title, created_by) values (:M_LEO, 'En réserve', :M_PAPA) returning id as i_reserve \gset
\set I_RESERVE '''':i_reserve''''
select tests.ok(tests.affected(format('update public.ideas set event_id = %L where id = %L', :E_NOEL, :I_RESERVE)) = 1,
  'rattacher une idée en réserve');
select tests.refused(format('update public.ideas set event_id = null where id = %L', :I_RESERVE),
  'détacher une idée d''un événement en cours');

-- Idée rattachée à l'événement passé (création directe pour le test)
reset role;
alter table public.ideas disable trigger ideas_guard;
insert into public.ideas (id, beneficiary_id, event_id, title, created_by)
  values ('20000000-0000-0000-0000-000000000001', :M_LEO, :E_PASSE, 'Ancien', :M_PAPA);
alter table public.ideas enable trigger ideas_guard;
set role kdo_user;

select tests.login(:MAMIE);
select tests.refused(format('insert into public.contributions (idea_id, event_id, member_id, percent) values (%L, %L, %L, 10)',
  '20000000-0000-0000-0000-000000000001', :E_PASSE, :M_MAMIE), 'participer à un événement passé');

select tests.login(:PAPA);
select tests.ok(tests.affected(format('update public.ideas set event_id = %L where id = %L', :E_NOEL,
  '20000000-0000-0000-0000-000000000001')) = 1, 'reporter une idée d''un événement passé');

-- ---------------------------------------------------------------------
-- Émancipation
-- ---------------------------------------------------------------------
select tests.login(:LEO_U);
select tests.refused(format('select public.emancipate_child(%L)', :M_LEO), 'un enfant s''émancipe seul');
select tests.ok(tests.affected(format('update public.members set display_name = ''Léo'' where id = %L', :M_LEO)) = 1,
  'Léo change son nom affiché');
select tests.refused(format('update public.members set is_child = false where id = %L', :M_LEO), 'Léo modifie is_child');

select tests.login(:PAPA);
select public.emancipate_child(:M_LEO);
select tests.login(:LEO_U);
insert into public.list_shares (owner_id, member_id) values (:M_LEO, :M_ONCLE);
select tests.ok((select count(*) from public.ideas where id = :I_VELO) = 0, 'après émancipation, toujours pas de vélo visible');

-- Réinitialisation de mot de passe par un adulte de la famille
select tests.login(:PAPA);
select tests.ok(length(public.create_password_reset(:M_MAMAN)) = 64, 'papa crée un lien de réinitialisation pour maman');
select tests.refused(format('select public.create_password_reset(%L)', :M_PAPA), 'réinitialiser soi-même');
select tests.login(:LEO_U);
select tests.ok(length(public.create_password_reset(:M_MAMAN)) = 64, 'Léo émancipé est adulte : il peut aussi aider');

reset role;
select 'OK : toutes les règles sont respectées' as resultat;
