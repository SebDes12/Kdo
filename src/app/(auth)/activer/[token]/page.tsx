import Link from "next/link";
import type { Metadata } from "next";
import { activateChild } from "@/app/actions/auth";
import { SubmitButton } from "@/components/client";
import { AuthCard, Notice } from "@/components/ui";
import { sha256 } from "@/lib/auth";
import { asAdmin } from "@/lib/db";

export const metadata: Metadata = { title: "Activer mon compte" };

/** Pseudo proposé à partir du prénom : « Léa-Rose » → « lea-rose ». */
function suggestLogin(name: string): string {
  const s = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "")
    .slice(0, 31);
  return s.length >= 2 ? s : "";
}

export default async function ActivatePage({ params }: PageProps<"/activer/[token]">) {
  const { token } = await params;
  const [link] = await asAdmin((q) =>
    q<{ name: string; login: string | null; parent: string | null }>(
      `select m.display_name as name, m.login, p.display_name as parent
       from login_links l join members m on m.id = l.member_id
       left join members p on p.id = l.created_by
       where l.token_hash = $1 and l.used_at is null and l.expires_at > now() and m.is_child`,
      [sha256(token)],
    ),
  );

  if (!link) {
    // Pourquoi ce lien est-il refusé ? Utilisé / remplacé par un plus récent, ou vraiment expiré.
    const [old] = await asAdmin((q) =>
      q<{ used: boolean }>("select used_at is not null as used from login_links where token_hash = $1", [sha256(token)]),
    );
    if (old?.used) {
      return (
        <AuthCard title="Lien déjà utilisé">
          <Notice tone="info">
            Ce lien a déjà servi, ou ton parent t&apos;en a envoyé un plus récent. Si ton compte est déjà activé, connecte-toi
            avec ton pseudo et ton mot de passe.
          </Notice>
          <Link href="/connexion" className="btn-primary w-full">Me connecter</Link>
        </AuthCard>
      );
    }
    return (
      <AuthCard title={old ? "Lien expiré" : "Lien introuvable"}>
        <Notice tone="info">
          {old
            ? "Ce lien a expiré. Demande-en un nouveau à ton parent."
            : "Ce lien n'est pas valide : vérifie qu'il est copié en entier, ou demande-en un nouveau à ton parent."}
        </Notice>
        <Link href="/connexion" className="btn-secondary w-full">J&apos;ai déjà un compte</Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title={`Bonjour ${link.name} 👋`}
      subtitle={`${link.parent ?? "Ton parent"} t'invite à écrire ta liste de cadeaux sur Kdo.`}
    >
      <form action={activateChild.bind(null, token)} className="space-y-4">
        <div>
          <label className="label" htmlFor="login">Ton pseudo</label>
          {link.login ? (
            <p className="field bg-stone-50 font-bold">{link.login}</p>
          ) : (
            <input
              id="login"
              name="login"
              className="field"
              defaultValue={suggestLogin(link.name)}
              pattern="[a-z0-9][a-z0-9._\-]{1,30}"
              autoCapitalize="none"
              autoCorrect="off"
              required
            />
          )}
          <p className="hint">C&apos;est lui que tu taperas pour te connecter (pas besoin d&apos;e-mail).</p>
        </div>
        <div>
          <label className="label" htmlFor="password">Choisis ton mot de passe</label>
          <input id="password" name="password" type="password" className="field" minLength={6} required autoComplete="new-password" />
          <p className="hint">6 caractères minimum</p>
        </div>
        <SubmitButton className="btn-primary w-full" pendingText="C'est parti…">C&apos;est parti !</SubmitButton>
      </form>
    </AuthCard>
  );
}
