-- Liens de connexion plus durables : un lien envoyé par message est souvent
-- ouvert plusieurs jours plus tard.
--   * activation d'un enfant : 7 → 30 jours
--   * réinitialisation du mot de passe d'un adulte : 2 → 7 jours
-- Les liens non utilisés déjà envoyés bénéficient aussi de la nouvelle durée.

alter table public.login_links    alter column expires_at set default now() + interval '30 days';
alter table public.password_resets alter column expires_at set default now() + interval '7 days';

update public.login_links
   set expires_at = created_at + interval '30 days'
 where used_at is null and expires_at < created_at + interval '30 days';

update public.password_resets
   set expires_at = created_at + interval '7 days'
 where used_at is null and expires_at < created_at + interval '7 days';
