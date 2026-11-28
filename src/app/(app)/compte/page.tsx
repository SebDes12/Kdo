import type { Metadata } from "next";
import Link from "next/link";
import { logout, updatePassword } from "@/app/actions/auth";
import { renameMember } from "@/app/actions/family";
import { SubmitButton } from "@/components/client";
import { ThemePicker } from "@/components/theme";
import { Avatar, PageHeader, Section } from "@/components/ui";
import { asAdmin } from "@/lib/db";
import { getSession } from "@/lib/session";

export const metadata: Metadata = { title: "Mon compte" };

export default async function AccountPage() {
  const { me, member, parentLinks } = await getSession();
  const [account] = await asAdmin((q) =>
    q<{ identifiant: string | null }>(
      `select coalesce(a.email, m.login) as identifiant
       from members m left join accounts a on a.member_id = m.id where m.id = $1`,
      [me.id],
    ),
  );
  const parents = parentLinks.filter((l) => l.child_id === me.id).map((l) => member(l.parent_id)?.display_name).filter(Boolean);

  return (
    <>
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <Avatar member={me} size="lg" /> {me.display_name}
          </span>
        }
        subtitle={me.is_child ? `Compte enfant${parents.length ? `, géré par ${parents.join(" et ")}` : ""}` : undefined}
      />

      {account?.identifiant && (
        <Section title="Mon identifiant de connexion">
          <div className="card p-4 text-sm">
            <p className="break-all text-lg font-bold">{account.identifiant}</p>
            <p className="hint mt-1">
              {me.is_child ? "C'est ton pseudo" : "C'est ton e-mail"} : tape-le avec ton mot de passe quand tu te reconnectes
              sur un autre appareil.
            </p>
          </div>
        </Section>
      )}

      <Section title="Mon prénom">
        <form action={renameMember.bind(null, me.id)} className="card flex gap-2 p-4">
          <input type="hidden" name="back" value="/compte" />
          <input name="name" className="field" defaultValue={me.display_name} required maxLength={60} aria-label="Prénom" />
          <SubmitButton className="btn-secondary shrink-0">Enregistrer</SubmitButton>
        </form>
      </Section>

      <Section title="Apparence">
        <ThemePicker current={me.theme ?? "or"} />
      </Section>

      <Section title="Visite guidée">
        <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
          <p className="text-sm text-muted">Revoir la présentation de Kdo, étape par étape.</p>
          <Link href="/?visite=1" className="btn-secondary">Revoir la visite</Link>
        </div>
      </Section>

      {!me.is_child && (
        <Section title="Mot de passe" id="mot-de-passe">
          <form action={updatePassword} className="card grid gap-2 p-4 sm:grid-cols-[1fr_1fr_auto]">
            <input name="current" type="password" className="field" placeholder="Mot de passe actuel" required autoComplete="current-password" aria-label="Mot de passe actuel" />
            <input name="password" type="password" className="field" placeholder="Nouveau mot de passe" minLength={8} required autoComplete="new-password" aria-label="Nouveau mot de passe" />
            <SubmitButton className="btn-secondary">Changer</SubmitButton>
          </form>
        </Section>
      )}

      <form action={logout}>
        <SubmitButton className="btn-danger w-full sm:w-auto">Se déconnecter</SubmitButton>
      </form>
    </>
  );
}
