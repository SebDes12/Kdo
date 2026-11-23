import Link from "next/link";
import type { Metadata } from "next";
import { acceptInvitation } from "@/app/actions/auth";
import { AuthCard, Notice } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { AccountFields } from "../../account-fields";

export const metadata: Metadata = { title: "Invitation" };

export default async function InvitationPage({ params }: PageProps<"/invitation/[token]">) {
  const { token } = await params;
  const admin = createAdminClient();
  const { data: inv } = await admin
    .from("invitations")
    .select("token, used_at, expires_at, creator:members!invitations_created_by_fkey(display_name), group:groups(name)")
    .eq("token", token)
    .maybeSingle();

  const valid = inv && !inv.used_at && new Date(inv.expires_at) > new Date();
  if (!valid) {
    return (
      <AuthCard title="Invitation expirée">
        <Notice tone="info">Ce lien a déjà été utilisé ou a expiré. Demande un nouveau lien à ta famille.</Notice>
        <Link href="/connexion" className="btn-secondary w-full">J&apos;ai déjà un compte</Link>
      </AuthCard>
    );
  }
  const creator = (inv.creator as unknown as { display_name: string } | null)?.display_name;
  const group = (inv.group as unknown as { name: string } | null)?.name;

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
