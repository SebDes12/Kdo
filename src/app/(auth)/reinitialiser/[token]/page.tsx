import Link from "next/link";
import type { Metadata } from "next";
import { resetPassword } from "@/app/actions/auth";
import { AuthCard, Notice } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { sha256 } from "@/lib/auth";
import { asAdmin } from "@/lib/db";

export const metadata: Metadata = { title: "Nouveau mot de passe" };

export default async function ResetPage({ params }: PageProps<"/reinitialiser/[token]">) {
  const { token } = await params;
  const [reset] = await asAdmin((q) =>
    q<{ name: string; identifiant: string | null; valid: boolean }>(
      `select m.display_name as name, coalesce(a.email, m.login) as identifiant,
              (r.used_at is null and r.expires_at > now()) as valid
       from password_resets r join members m on m.id = r.member_id
       left join accounts a on a.member_id = m.id
       where r.token_hash = $1`,
      [sha256(token)],
    ),
  );
  if (!reset?.valid) {
    return (
      <AuthCard title="Lien expiré">
        <Notice tone="info">Ce lien a déjà servi ou a expiré. Demande-en un nouveau à ta famille.</Notice>
        {reset?.identifiant && (
          <p className="mb-4 text-center text-sm">
            Ton identifiant : <strong className="break-all text-base">{reset.identifiant}</strong>
          </p>
        )}
        <Link
          href={reset?.identifiant ? `/connexion?identifiant=${encodeURIComponent(reset.identifiant)}` : "/connexion"}
          className="btn-secondary w-full"
        >
          Retour à la connexion
        </Link>
      </AuthCard>
    );
  }
  return (
    <AuthCard title={`Bonjour ${reset.name}`} subtitle="Choisis ton nouveau mot de passe.">
      <form action={resetPassword.bind(null, token)} className="space-y-4">
        <div>
          <label className="label" htmlFor="password">Nouveau mot de passe</label>
          <input id="password" name="password" type="password" className="field" minLength={8} required autoComplete="new-password" />
          <p className="hint">8 caractères minimum</p>
        </div>
        {reset.identifiant && (
          <p className="text-sm text-muted">
            Pour te reconnecter plus tard, ton identifiant est <strong className="break-all text-ink">{reset.identifiant}</strong>.
          </p>
        )}
        <SubmitButton className="btn-primary w-full" pendingText="Enregistrement…">Enregistrer</SubmitButton>
      </form>
    </AuthCard>
  );
}
