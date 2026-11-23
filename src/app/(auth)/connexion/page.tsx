import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { login, logout } from "@/app/actions/auth";
import { AuthCard, Notice } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Connexion" };

export default async function LoginPage({ searchParams }: PageProps<"/connexion">) {
  const sp = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  if (data?.claims && !sp.orphelin) redirect("/");

  if (data?.claims && sp.orphelin) {
    return (
      <AuthCard title="Compte non rattaché">
        <Notice tone="info">Ce compte n&apos;est rattaché à aucun membre de la famille.</Notice>
        <form action={logout}>
          <SubmitButton className="btn-secondary w-full">Se déconnecter</SubmitButton>
        </form>
      </AuthCard>
    );
  }

  const { count } = await createAdminClient().from("members").select("id", { count: "exact", head: true });
  if (count === 0) redirect("/bienvenue");

  return (
    <AuthCard title="Kdo" subtitle="Les idées cadeaux de la famille">
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
