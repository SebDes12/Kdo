import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { sessionTokenHash } from "@/lib/auth";
import { asUser, type Sql } from "@/lib/db";
import type { Member, ParentLink } from "@/lib/types";

/** Membre connecté d'après le cookie, ou null (session absente ou expirée). */
export async function currentMemberId(): Promise<string | null> {
  const tokenHash = await sessionTokenHash();
  if (!tokenHash) return null;
  const [row] = await asUser(tokenHash, (q) => q<{ id: string | null }>("select current_member_id() as id"));
  return row?.id ?? null;
}

/**
 * Charge le membre connecté et l'annuaire familial.
 * Redirige vers /connexion si la session est absente ou expirée.
 *
 * `q` exécute une requête sous l'identité de l'utilisateur (RLS appliquée),
 * `tx` plusieurs requêtes dans une même transaction.
 */
export const getSession = cache(async () => {
  const tokenHash = await sessionTokenHash();
  if (!tokenHash) redirect("/connexion");
  const tx = <T,>(fn: (q: Sql) => Promise<T>) => asUser(tokenHash, fn);
  const q: Sql = (text, params) => tx((t) => t(text, params));

  const { meId, all, parentLinks } = await tx(async (t) => {
    const [me] = await t<{ id: string | null }>("select current_member_id() as id");
    const members = await t<Member>(
      "select id, display_name, is_child, login from members order by display_name",
    );
    const links = await t<ParentLink>("select parent_id, child_id from parent_links");
    return { meId: me?.id ?? null, all: members, parentLinks: links };
  });
  const me = all.find((m) => m.id === meId);
  if (!me) redirect("/connexion?expiree=1");

  const childIds = parentLinks.filter((l) => l.parent_id === me.id).map((l) => l.child_id);
  const byId = new Map(all.map((m) => [m.id, m]));

  return {
    q,
    tx,
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
