import { redirect } from "next/navigation";
import { connection } from "next/server";
import type { Metadata } from "next";
import { bootstrap } from "@/app/actions/auth";
import { AuthCard } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { AccountFields } from "../account-fields";

export const metadata: Metadata = { title: "Bienvenue" };

export default async function BootstrapPage() {
  await connection();
  const { count } = await createAdminClient().from("members").select("id", { count: "exact", head: true });
  if ((count ?? 0) > 0) redirect("/connexion");
  return (
    <AuthCard title="Bienvenue sur Kdo 🎉" subtitle="Crée le premier compte de la famille. Tu pourras ensuite inviter les autres.">
      <form action={bootstrap} className="space-y-4">
        <AccountFields />
        <SubmitButton className="btn-primary w-full" pendingText="Création…">Créer mon compte</SubmitButton>
      </form>
    </AuthCard>
  );
}
