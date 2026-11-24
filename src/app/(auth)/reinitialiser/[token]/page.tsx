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
    q<{ name: string }>(
      `select m.display_name as name from password_resets r join members m on m.id = r.member_id
       where r.token_hash = $1 and r.used_at is null and r.expires_at > now()`,
      [sha256(token)],
    ),
  );
  if (!reset) {
    return (
      <AuthCard title="Lien expiré">
        <Notice tone="info">Ce lien a déjà servi ou a expiré. Demande-en un nouveau à ta famille.</Notice>
        <Link href="/connexion" className="btn-secondary w-full">Retour à la connexion</Link>
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
        <SubmitButton className="btn-primary w-full" pendingText="Enregistrement…">Enregistrer</SubmitButton>
      </form>
    </AuthCard>
  );
}
