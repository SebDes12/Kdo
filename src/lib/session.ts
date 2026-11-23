import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Member, ParentLink } from "@/lib/types";

/**
 * Charge l'utilisateur connecté, son profil membre et l'annuaire familial.
 * Redirige vers /connexion si personne n'est connecté.
 */
export const getSession = cache(async () => {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (!userId) redirect("/connexion");

  const [{ data: members }, { data: links }] = await Promise.all([
    supabase.from("members").select("id, user_id, display_name, is_child, login").order("display_name"),
    supabase.from("parent_links").select("parent_id, child_id"),
  ]);
  const all = (members ?? []) as Member[];
  const me = all.find((m) => m.user_id === userId);
  if (!me) redirect("/connexion?orphelin=1");

  const parentLinks = (links ?? []) as ParentLink[];
  const childIds = parentLinks.filter((l) => l.parent_id === me.id).map((l) => l.child_id);
  const byId = new Map(all.map((m) => [m.id, m]));

  return {
    supabase,
    me,
    members: all,
    parentLinks,
    childIds,
    children: childIds.map((id) => byId.get(id)).filter((m): m is Member => !!m),
    member: (id: string | null | undefined) => (id ? byId.get(id) : undefined),
    isParentOf: (id: string) => childIds.includes(id),
    canManageList: (id: string) => id === me.id || childIds.includes(id),
  };
});

export type Session = Awaited<ReturnType<typeof getSession>>;
