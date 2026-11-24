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
-- Papa (membre du groupe) y ajoute maman, mamie et son fils Léo ; l'oncle n'en fait pas partie
insert into public.group_members (group_id, member_id) values (:G_FAM, :M_MAMAN), (:G_FAM, :M_MAMIE), (:G_FAM, :M_LEO);

-- Léo obtient un identifiant (fait côté serveur, hors kdo_user)
reset role;
update public.members set login = 'leo' where id = :M_LEO;
insert into public.accounts (member_id, password_hash) values (:M_LEO, 'x');
insert into public.sessions (token_hash, member_id, expires_at) values ('session-' || :M_LEO, :M_LEO, now() + interval '1 day');
set role kdo_user;
\set LEO_U :M_LEO

-- Un enfant ne crée pas de groupe et n'y ajoute personne
select tests.login(:LEO_U);
select tests.refused('select public.create_group(''x'')', 'un enfant crée un groupe');
select tests.refused(format('insert into public.group_members (group_id, member_id) values (%L, %L)', :G_FAM, :M_ONCLE),
  'un enfant ajoute quelqu''un à un groupe');

-- Événements : Noël (à venir) pour papa, maman, Léo
select tests.login(:PAPA);
insert into public.events (name, event_date, created_by) values ('Noël', current_date + 30, :M_PAPA) returning id as noel \gset
\set E_NOEL '''':noel''''
insert into public.events (name, event_date, created_by) values ('Anniv passé', current_date - 10, :M_PAPA) returning id as passe \gset
\set E_PASSE '''':passe''''
insert into public.event_groups (event_id, group_id) values (:E_NOEL, :G_FAM), (:E_PASSE, :G_FAM);

-- L'oncle a son propre groupe et son événement ; il ne peut pas y rattacher le groupe de papa
select tests.login(:ONCLE);
select public.create_group('Amis') as amis \gset
\set G_AMIS '''':amis''''
insert into public.events (name, event_date, created_by) values ('Soirée', current_date + 5, :M_ONCLE) returning id as soiree \gset
\set E_SOIREE '''':soiree''''
insert into public.event_groups (event_id, group_id) values (:E_SOIREE, :G_AMIS);
select tests.refused(format('insert into public.event_groups (event_id, group_id) values (%L, %L)', :E_SOIREE, :G_FAM),
  'rattacher un groupe dont on n''est pas membre');
select tests.login(:PAPA);
select tests.refused(format('insert into public.event_groups (event_id, group_id) values (%L, %L)', :E_SOIREE, :G_FAM),
  'rattacher un groupe à l''événement de quelqu''un d''autre');
select tests.ok((select count(*) from public.events where id = :E_SOIREE) = 0, 'papa ne voit pas l''événement de l''oncle');

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
  'idée visible pour quelqu''un d''autre');
select tests.refused(format('insert into public.ideas (beneficiary_id, event_id, title, created_by) values (%L, %L, ''x'', %L)', :M_PAPA, :E_SOIREE, :M_PAPA),
  'rattacher son idée à un événement dont on ne fait pas partie');

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
select tests.ok((select count(*) from public.events where id = :E_NOEL) = 0, 'oncle ne voit pas Noël');
select tests.refused(format('insert into public.ideas (beneficiary_id, event_id, title, is_secret, created_by) values (%L, %L, ''x'', true, %L)', :M_PAPA, :E_NOEL, :M_ONCLE),
  'oncle suggère sur un événement dont il ne fait pas partie');
select tests.refused(format('insert into public.ideas (beneficiary_id, title, is_secret, created_by) values (%L, ''x'', true, %L)', :M_PAPA, :M_ONCLE),
  'oncle suggère hors événement');

-- Un nouvel arrivant dans le groupe voit aussitôt l'événement et les idées
reset role;
insert into public.group_members (group_id, member_id) values (:G_FAM, :M_ONCLE);
set role kdo_user;
select tests.ok((select count(*) from public.events where id = :E_NOEL) = 1, 'oncle ajouté au groupe : il voit Noël');
select tests.ok((select count(*) from public.ideas where beneficiary_id = :M_PAPA) = 2, 'oncle ajouté au groupe : il voit les idées de papa');
select tests.ok((select sum(percent) from public.contributions where idea_id = :I_PERCEUSE) = 100, 'oncle voit que la perceuse est prise');
reset role;
delete from public.group_members where group_id = :G_FAM and member_id = :M_ONCLE;
set role kdo_user;
select tests.ok((select count(*) from public.ideas) = 0, 'oncle retiré du groupe : il ne voit plus rien');

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
select tests.ok((select count(*) from public.contributions c join public.ideas i on i.id = c.idea_id where i.beneficiary_id = :M_LEO) = 0 and (select count(*) from public.contributions where idea_id = :I_LEGO) = 0, 'Léo ne voit aucune participation sur ses idées');

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
select tests.ok(tests.affected(format('update public.ideas set event_id = null where id = %L', :I_RESERVE)) = 1,
  'retirer une idée d''un événement en cours');
select tests.ok(tests.affected(format('update public.ideas set event_id = %L where id = %L', :E_NOEL, :I_RESERVE)) = 1,
  'la remettre dans l''événement');

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
-- Période, déplacement, retrait et suppression logique
-- ---------------------------------------------------------------------
select tests.login(:PAPA);
select tests.refused(format('insert into public.events (name, event_date, end_date, created_by) values (''x'', current_date, current_date - 1, %L)', :M_PAPA),
  'période qui finit avant de commencer');
-- Un événement commencé hier et qui dure jusqu'à demain est encore ouvert
insert into public.events (name, event_date, end_date, created_by)
  values ('Anniv Léo (en plusieurs fois)', current_date - 1, current_date + 1, :M_PAPA) returning id as anniv \gset
\set E_ANNIV '''':anniv''''
insert into public.event_groups (event_id, group_id) values (:E_ANNIV, :G_FAM);

-- Le Lego de Léo (pris à 100 % par mamie) est déplacé vers l'anniversaire : la réservation suit
select tests.ok(tests.affected(format('update public.ideas set event_id = %L where id = %L', :E_ANNIV, :I_LEGO)) = 1,
  'déplacer une idée choisie vers un autre événement en cours');
select tests.login(:MAMIE);
select tests.ok((select event_id from public.contributions where idea_id = :I_LEGO) = :E_ANNIV, 'la réservation suit l''idée déplacée');
select tests.refused(format('insert into public.contributions (idea_id, event_id, member_id, percent) values (%L, %L, %L, 10)', :I_LEGO, :E_ANNIV, :M_MAMAN),
  'l''idée déplacée reste prise à 100 %');

-- Papa la retire de l'événement (mise en réserve) : mamie la voit toujours, avec sa réservation
select tests.login(:PAPA);
select tests.ok(tests.affected(format('update public.ideas set event_id = null where id = %L', :I_LEGO)) = 1,
  'retirer une idée choisie d''un événement en cours');
select tests.login(:MAMIE);
select tests.ok((select count(*) from public.ideas where id = :I_LEGO and event_id is null) = 1, 'mamie voit toujours l''idée retirée');
select tests.ok((select count(*) from public.contributions where idea_id = :I_LEGO) = 1, 'mamie garde sa réservation');
select tests.login(:MAMAN);
select tests.ok((select count(*) from public.contributions where idea_id = :I_LEGO) = 1, 'maman (parent) voit encore la réservation de mamie');

-- Suppression : papa supprime sa perceuse (prise par maman et mamie)
select tests.login(:PAPA);
select public.delete_idea(:I_PERCEUSE);
select tests.ok((select count(*) from public.ideas where id = :I_PERCEUSE) = 0, 'papa ne voit plus la perceuse supprimée');
select tests.refused(format('select public.delete_idea(%L)', :I_PERCEUSE), 'supprimer deux fois');
select tests.refused(format('delete from public.ideas where id = %L', :I_RESERVE), 'DELETE direct interdit');
select tests.login(:MAMAN);
select tests.ok((select count(*) from public.ideas where id = :I_PERCEUSE and deleted_at is not null) = 1, 'maman (qui l''a choisie) voit la perceuse supprimée');
select tests.ok(tests.affected(format('update public.ideas set title = ''x'' where id = %L', :I_PERCEUSE)) = 0, 'une idée supprimée ne se modifie plus');
select tests.login(:LEO_U);
select tests.ok((select count(*) from public.ideas where id = :I_PERCEUSE) = 0, 'Léo (membre, pas acheteur) ne voit plus la perceuse');

-- Une idée en réserve jamais choisie est effacée tout de suite ; une idée d'événement est seulement masquée
select tests.login(:PAPA);
insert into public.ideas (beneficiary_id, title, created_by) values (:M_PAPA, 'Brouillon', :M_PAPA) returning id as i_brouillon \gset
select public.delete_idea(:'i_brouillon');
insert into public.ideas (beneficiary_id, event_id, title, created_by) values (:M_PAPA, :E_NOEL, 'Jamais choisie', :M_PAPA) returning id as i_jamais \gset
select public.delete_idea(:'i_jamais');
reset role;
select tests.ok((select count(*) from public.ideas where id = :'i_brouillon') = 0, 'idée en réserve jamais choisie : effacée physiquement');
select tests.ok((select count(*) from public.ideas where id = :'i_jamais' and deleted_at is not null) = 1, 'idée d''événement : suppression logique');

-- Purge : rien avant J+2 après la fin, tout après
select tests.ok(public.purge_deleted_ideas() = 0, 'pas de purge avant la fin de l''événement');
update public.events set event_date = current_date - 10, end_date = current_date - 2 where id = :E_NOEL;
select tests.ok(public.purge_deleted_ideas() = 0, 'pas de purge à J+2');
update public.events set end_date = current_date - 3 where id = :E_NOEL;
select tests.ok(public.purge_deleted_ideas() = 2, 'purge à J+3 : perceuse et idée jamais choisie effacées');
select tests.ok((select count(*) from public.contributions where idea_id = :I_PERCEUSE) = 0, 'les réservations de l''idée purgée disparaissent');
update public.events set event_date = current_date + 30, end_date = current_date + 30 where id = :E_NOEL;
set role kdo_user;

-- ---------------------------------------------------------------------
-- Modération : administrateurs, réglage de création, corbeille
-- ---------------------------------------------------------------------
reset role;
select tests.ok((select is_admin from public.group_members where group_id = :G_FAM and member_id = :M_PAPA), 'le créateur du groupe en est administrateur');
set role kdo_user;

-- Mamie (simple membre) crée un événement pour le groupe et y met une idée ; maman la choisit
select tests.login(:MAMIE);
insert into public.events (name, event_date, created_by) values ('Fête de mamie', current_date + 20, :M_MAMIE) returning id as fete \gset
\set E_FETE '''':fete''''
insert into public.event_groups (event_id, group_id) values (:E_FETE, :G_FAM);
insert into public.ideas (beneficiary_id, event_id, title, created_by) values (:M_MAMIE, :E_FETE, 'Orchidée', :M_MAMIE) returning id as i_orchidee \gset
select tests.login(:MAMAN);
insert into public.contributions (idea_id, event_id, member_id, percent) values (:'i_orchidee', :E_FETE, :M_MAMAN, 100);

-- Maman (membre, pas admin, pas créatrice) ne peut ni modifier ni supprimer l'événement
select tests.ok(tests.affected(format('update public.events set name = ''x'' where id = %L', :E_FETE)) = 0, 'un simple membre ne modifie pas l''événement d''un autre');
select tests.refused(format('select public.delete_event(%L)', :E_FETE), 'un simple membre ne supprime pas l''événement d''un autre');
select tests.ok(tests.affected(format('update public.groups set name = ''x'' where id = %L', :G_FAM)) = 0, 'un simple membre ne renomme pas le groupe');
select tests.refused(format('select public.set_group_admin(%L, %L, true)', :G_FAM, :M_MAMAN), 'se nommer administrateur soi-même');
select tests.refused(format('insert into public.group_members (group_id, member_id, is_admin) values (%L, %L, true)', :G_FAM, :M_ONCLE),
  'un simple membre ajoute un administrateur');

-- Papa (admin du groupe) renomme puis supprime l'événement de mamie
select tests.login(:PAPA);
select tests.ok(tests.affected(format('update public.events set name = ''Fête de Mamie'' where id = %L', :E_FETE)) = 1, 'un admin du groupe modifie l''événement');
select tests.ok((select updated_by from public.events where id = :E_FETE) = :M_PAPA, 'on sait qui a modifié l''événement');
select public.delete_event(:E_FETE);
select tests.ok((select deleted_by from public.events where id = :E_FETE) = :M_PAPA, 'papa voit l''événement dans la corbeille');
select tests.login(:LEO_U);
select tests.ok((select count(*) from public.events where id = :E_FETE) = 0, 'un membre ne voit plus l''événement supprimé');
select tests.login(:MAMAN);
select tests.ok((select count(*) from public.events where id = :E_FETE) = 1, 'maman, qui y avait choisi un cadeau, le voit encore');
select tests.refused(format('select public.restore_event(%L)', :E_FETE), 'un simple membre ne restaure pas');
select tests.login(:MAMIE);
select tests.refused(format('insert into public.ideas (beneficiary_id, event_id, title, created_by) values (%L, %L, ''x'', %L)', :M_MAMIE, :E_FETE, :M_MAMIE),
  'pas de nouvelle idée sur un événement supprimé');
select public.restore_event(:E_FETE);
select tests.login(:LEO_U);
select tests.ok((select count(*) from public.events where id = :E_FETE) = 1, 'événement restauré : visible à nouveau');
select tests.ok((select count(*) from public.contributions where event_id = :E_FETE) = 1, 'les choix sont restaurés aussi');

-- Réglage : seuls les admins créent des événements pour le groupe
select tests.login(:PAPA);
update public.groups set event_creation = 'admins' where id = :G_FAM;
select tests.login(:MAMIE);
insert into public.events (name, event_date, created_by) values ('Spam', current_date + 3, :M_MAMIE) returning id as spam \gset
select tests.refused(format('insert into public.event_groups (event_id, group_id) values (%L, %L)', :'spam', :G_FAM),
  'groupe réservé aux admins : un membre n''y rattache pas d''événement');
select tests.login(:PAPA);
update public.groups set event_creation = 'members' where id = :G_FAM;

-- Nommer / retirer des administrateurs, jamais le dernier
select public.set_group_admin(:G_FAM, :M_MAMAN, true);
select tests.refused(format('select public.set_group_admin(%L, %L, true)', :G_FAM, :M_LEO), 'un enfant administrateur');
select public.set_group_admin(:G_FAM, :M_PAPA, false);
select tests.login(:MAMAN);
select tests.refused(format('select public.set_group_admin(%L, %L, false)', :G_FAM, :M_MAMAN), 'retirer le dernier administrateur');
select public.set_group_admin(:G_FAM, :M_PAPA, true);

-- Corbeille vidée après 30 jours
select public.delete_event(:E_FETE);
reset role;
select tests.ok(public.purge_deleted_events() = 0, 'pas d''effacement avant 30 jours');
update public.events set deleted_at = now() - interval '31 days' where id = :E_FETE;
select tests.ok(public.purge_deleted_events() = 1, 'effacement définitif après 30 jours');
select tests.ok((select event_id from public.ideas where id = :'i_orchidee') is null, 'l''idée repasse en réserve');
set role kdo_user;

-- Lien d'activation pour un enfant
select tests.login(:PAPA);
select tests.ok(length(public.create_child_login_link(:M_LEO)) = 64, 'papa crée un lien de connexion pour Léo');
select tests.ok(length(public.create_child_login_link(:M_LEO)) = 64, 'un nouveau lien remplace le précédent');
reset role;
select tests.ok((select count(*) from public.login_links where member_id = :M_LEO and used_at is null) = 1, 'un seul lien valable à la fois');
set role kdo_user;
select tests.refused(format('select public.create_child_login_link(%L)', :M_MAMAN), 'lien pour un adulte');
select tests.refused('select * from public.login_links', 'lire les liens de connexion');
select tests.login(:MAMIE);
select tests.refused(format('select public.create_child_login_link(%L)', :M_LEO), 'lien pour l''enfant de quelqu''un d''autre');

-- Suppression d'un enfant en double
select tests.login(:MAMAN);
select public.create_child('Léo (doublon)') as doublon \gset
select tests.login(:MAMIE);
select tests.refused(format('select public.delete_child(%L)', :'doublon'), 'supprimer l''enfant de quelqu''un d''autre');
select tests.refused(format('select public.delete_child(%L)', :M_PAPA), 'supprimer un adulte');
select tests.login(:MAMAN);
select tests.refused(format('select public.delete_child(%L)', :M_PAPA), 'un parent supprime un adulte');
select public.delete_child(:'doublon');
select tests.ok((select count(*) from public.members where id = :'doublon') = 0, 'maman supprime le doublon');
select tests.ok((select count(*) from public.members where id = :M_LEO) = 1, 'le vrai Léo est intact');

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
select tests.ok((select count(*) from public.ideas where id = :I_VELO) = 0, 'après émancipation, toujours pas de vélo visible');

-- Un parent peut retirer son enfant d'un groupe (test avant émancipation impossible ici : Léo est adulte)

-- Réinitialisation de mot de passe par un adulte de la famille
select tests.login(:PAPA);
select tests.ok(length(public.create_password_reset(:M_MAMAN)) = 64, 'papa crée un lien de réinitialisation pour maman');
select tests.refused(format('select public.create_password_reset(%L)', :M_PAPA), 'réinitialiser soi-même');
select tests.login(:LEO_U);
select tests.ok(length(public.create_password_reset(:M_MAMAN)) = 64, 'Léo émancipé est adulte : il peut aussi aider');

-- Invitations vers plusieurs groupes
select tests.login(:PAPA);
insert into public.invitations (created_by) values (:M_PAPA) returning token as inv_papa \gset
insert into public.invitation_groups (token, group_id) values (:'inv_papa', :G_FAM);
select tests.ok((select count(*) from public.invitation_groups where token = :'inv_papa') = 1, 'papa ajoute un groupe à son invitation');
select tests.login(:ONCLE);
insert into public.invitations (created_by) values (:M_ONCLE) returning token as inv_oncle \gset
select tests.refused(format('insert into public.invitation_groups (token, group_id) values (%L, %L)', :'inv_oncle', :G_FAM),
  'ajouter un groupe dont on n''est pas membre');
select tests.refused(format('insert into public.invitation_groups (token, group_id) values (%L, %L)', :'inv_papa', :G_FAM),
  'modifier l''invitation de quelqu''un d''autre');
select tests.login(:MAMAN);
select tests.ok((select count(*) from public.invitation_groups) = 0, 'maman ne voit pas les invitations de papa');

reset role;
select 'OK : toutes les règles sont respectées' as resultat;
