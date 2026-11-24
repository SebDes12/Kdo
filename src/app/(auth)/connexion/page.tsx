import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { login } from "@/app/actions/auth";
import { AuthCard, Notice } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { asAdmin } from "@/lib/db";
import { currentMemberId } from "@/lib/session";

export const metadata: Metadata = { title: "Connexion" };

export default async function LoginPage({ searchParams }: PageProps<"/connexion">) {
  const sp = await searchParams;
  if (await currentMemberId()) redirect("/");
  const [{ n }] = await asAdmin((q) => q<{ n: number }>("select count(*)::int as n from members"));
  if (n === 0) redirect("/bienvenue");

  return (
    <AuthCard title="Kdo" subtitle="Les idées cadeaux de la famille">
      {sp.expiree && <Notice tone="info">Ta session a expiré : reconnecte-toi.</Notice>}
      <form action={login} className="space-y-4">
        <div>
          <label className="label" htmlFor="identifiant">E-mail ou pseudo</label>
          <input id="identifiant" name="identifiant" className="field" autoComplete="username" autoCapitalize="none" required />
        </div>
        <div>
          <label className="label" htmlFor="password">Mot de passe</label>
          <input id="password" name="password" type="password" className="field" autoComplete="current-password" required />
        </div>
        <SubmitButton className="btn-primary w-full" pendingText="Connexion…">Se connecter</SubmitButton>
      </form>
      <p className="mt-5 text-center text-sm">
        <Link href="/mot-de-passe-oublie" className="font-semibold text-muted hover:text-ink">Mot de passe oublié ?</Link>
      </p>
      <p className="mt-2 text-center text-xs text-muted">Pas encore de compte ? Demande un lien d&apos;invitation à ta famille.</p>
    </AuthCard>
  );
}
