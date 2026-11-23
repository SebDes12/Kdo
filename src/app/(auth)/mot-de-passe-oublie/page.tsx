import Link from "next/link";
import type { Metadata } from "next";
import { requestPasswordReset } from "@/app/actions/auth";
import { AuthCard } from "@/components/ui";
import { SubmitButton } from "@/components/client";

export const metadata: Metadata = { title: "Mot de passe oublié" };

export default function ForgotPage() {
  return (
    <AuthCard title="Mot de passe oublié" subtitle="Tu vas recevoir un lien pour choisir un nouveau mot de passe.">
      <form action={requestPasswordReset} className="space-y-4">
        <div>
          <label className="label" htmlFor="email">E-mail</label>
          <input id="email" name="email" type="email" className="field" required />
        </div>
        <SubmitButton className="btn-primary w-full" pendingText="Envoi…">Envoyer le lien</SubmitButton>
      </form>
      <p className="mt-4 text-center text-sm text-muted">
        Un enfant a oublié son mot de passe ? Son parent peut le changer dans « Famille ».
      </p>
      <p className="mt-2 text-center text-sm">
        <Link href="/connexion" className="font-semibold text-muted hover:text-ink">← Retour</Link>
      </p>
    </AuthCard>
  );
}
