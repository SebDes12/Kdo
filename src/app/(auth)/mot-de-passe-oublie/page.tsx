import Link from "next/link";
import type { Metadata } from "next";
import { AuthCard } from "@/components/ui";

export const metadata: Metadata = { title: "Mot de passe oublié" };

export default function ForgotPage() {
  return (
    <AuthCard title="Mot de passe oublié" subtitle="Pas de panique : la famille peut t'aider.">
      <ol className="list-decimal space-y-2 pl-5 text-sm">
        <li>
          Demande à un <strong>adulte de la famille</strong> d&apos;ouvrir Kdo, page <strong>Famille</strong>.
        </li>
        <li>
          Dans « Toute la famille », il clique sur <strong>Mot de passe</strong> à côté de ton prénom et
          t&apos;envoie le lien obtenu.
        </li>
        <li>Ouvre ce lien et choisis un nouveau mot de passe.</li>
      </ol>
      <p className="mt-4 text-sm text-muted">Pour un enfant, c&apos;est son parent qui change le mot de passe.</p>
      <p className="mt-4 text-center text-sm">
        <Link href="/connexion" className="font-semibold text-muted hover:text-ink">← Retour</Link>
      </p>
    </AuthCard>
  );
}
