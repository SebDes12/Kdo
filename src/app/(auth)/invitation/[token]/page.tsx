import Link from "next/link";
import type { Metadata } from "next";
import { acceptInvitation } from "@/app/actions/auth";
import { AuthCard, Notice } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { asAdmin } from "@/lib/db";
import { AccountFields } from "../../account-fields";

export const metadata: Metadata = { title: "Invitation" };

export default async function InvitationPage({ params }: PageProps<"/invitation/[token]">) {
  const { token } = await params;
  const [inv] = await asAdmin((q) =>
    q<{ creator: string | null; group: string | null }>(
      `select m.display_name as creator, g.name as "group"
       from invitations i
       left join members m on m.id = i.created_by
       left join groups g on g.id = i.group_id
       where i.token = $1 and i.used_at is null and i.expires_at > now()`,
      [token],
    ),
  );
  if (!inv) {
    return (
      <AuthCard title="Invitation expirée">
        <Notice tone="info">Ce lien a déjà été utilisé ou a expiré. Demande un nouveau lien à ta famille.</Notice>
        <Link href="/connexion" className="btn-secondary w-full">J&apos;ai déjà un compte</Link>
      </AuthCard>
    );
  }
  const { creator, group } = inv;

  return (
    <AuthCard
      title="Rejoins la famille 🎁"
      subtitle={`${creator ?? "Quelqu'un"} t'invite sur Kdo${group ? ` (groupe « ${group} »)` : ""}.`}
    >
      <form action={acceptInvitation.bind(null, token)} className="space-y-4">
        <AccountFields />
        <SubmitButton className="btn-primary w-full" pendingText="Création…">Créer mon compte</SubmitButton>
      </form>
      <p className="mt-4 text-center text-sm">
        <Link href="/connexion" className="font-semibold text-muted hover:text-ink">J&apos;ai déjà un compte</Link>
      </p>
    </AuthCard>
  );
}
