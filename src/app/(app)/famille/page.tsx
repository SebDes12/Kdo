import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createChild, createGroup, createInvitation, createResetLink, deleteInvitation } from "@/app/actions/family";
import { ConfirmButton, ResetLinkButton, ShareLink, SubmitButton } from "@/components/client";
import { Avatar, Badge, Empty, Notice, PageHeader, Section } from "@/components/ui";
import { getSession } from "@/lib/session";
import { loadSharing } from "./load";
import { ShareToggles } from "./share-toggles";

export const metadata: Metadata = { title: "Famille" };

export default async function FamilyPage({ searchParams }: PageProps<"/famille">) {
  const sp = await searchParams;
  const session = await getSession();
  const { q, me, members, children, parentLinks, member } = session;
  if (me.is_child) redirect("/");

  const [{ groups, groupMembers, shares }, invRows] = await Promise.all([
    loadSharing(session),
    q("select token, group_id, expires_at, used_at, used_by from invitations order by created_at desc"),
  ]);
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
  const invitations = (invRows ?? []) as { token: string; group_id: string | null; expires_at: string; used_at: string | null; used_by: string | null }[];
  const pending = invitations.filter((i) => !i.used_at && new Date(i.expires_at) > new Date());
  const used = invitations.filter((i) => i.used_at).slice(0, 5);
  const myGroups = groups.filter((g) => groupMembers.some((gm) => gm.group_id === g.id && gm.member_id === me.id));
  const personShares = shares.filter((s) => s.owner_id === me.id && s.member_id);

  return (
    <>
      <PageHeader title="Famille" subtitle="Enfants, groupes, invitations et visibilité de ta liste." />

      {sp.bienvenue && (
        <Notice tone="ok">
          Bienvenue ! Pour démarrer : crée un groupe (ex. « Toute la famille »), invite les autres avec un lien, ajoute tes enfants puis crée un événement.
        </Notice>
      )}

      <Section title="Qui voit ma liste ?" id="visibilite" description="Les membres des groupes activés voient tes idées. Ils ne te disent jamais ce qu'ils ont choisi.">
        <ShareToggles
          owner={me}
          groups={groups}
          groupMembers={groupMembers}
          shares={shares}
          people={personShares.length ? personShares.map((s) => member(s.member_id)!).filter(Boolean) : undefined}
          back="/famille#visibilite"
        />
      </Section>

      <Section title="Mes enfants" id="enfants" description="Tu choisis qui voit leur liste. Ils ne voient jamais ce qui a été choisi.">
        <div className="space-y-3">
          {children.length > 0 && (
            <ul className="card divide-y divide-line">
              {children.map((c) => (
                <li key={c.id}>
                  <Link href={`/famille/enfants/${c.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-stone-50">
                    <Avatar member={c} />
                    <span className="flex-1 font-bold">{c.display_name}</span>
                    {c.login ? <Badge tone="green">connexion : {c.login}</Badge> : <Badge>sans connexion</Badge>}
                    <span className="text-muted">›</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <form action={createChild} className="flex gap-2">
            <input name="name" className="field" placeholder="Prénom de l'enfant" required maxLength={60} aria-label="Prénom de l'enfant" />
            <SubmitButton className="btn-secondary shrink-0">+ Ajouter un enfant</SubmitButton>
          </form>
        </div>
      </Section>

      <Section title="Groupes" id="groupes" description="Par exemple « Côté papa », « Côté maman », « Cousins ».">
        <div className="space-y-3">
          {groups.length > 0 && (
            <ul className="card divide-y divide-line">
              {groups.map((g) => {
                const ms = groupMembers.filter((gm) => gm.group_id === g.id);
                return (
                  <li key={g.id}>
                    <Link href={`/famille/groupes/${g.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-stone-50">
                      <span className="text-xl">👥</span>
                      <div className="min-w-0 flex-1">
                        <div className="font-bold">{g.name}</div>
                        <div className="truncate text-xs text-muted">{ms.map((x) => member(x.member_id)?.display_name).join(", ")}</div>
                      </div>
                      {myGroups.includes(g) && <Badge tone="brand">membre</Badge>}
                      <span className="text-muted">›</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
          <form action={createGroup} className="flex gap-2">
            <input name="name" className="field" placeholder="Nom du groupe" required maxLength={60} aria-label="Nom du groupe" />
            <SubmitButton className="btn-secondary shrink-0">+ Créer</SubmitButton>
          </form>
        </div>
      </Section>

      <Section title="Inviter quelqu'un" id="invitations" description="Chaque lien sert une seule fois et expire après 14 jours.">
        <form action={createInvitation} className="mb-4 flex flex-wrap gap-2">
          <select name="group" className="field flex-1" aria-label="Ajouter au groupe" defaultValue="">
            <option value="">Sans groupe</option>
            {myGroups.map((g) => <option key={g.id} value={g.id}>Ajouter au groupe « {g.name} »</option>)}
          </select>
          <SubmitButton className="btn-primary">Créer un lien</SubmitButton>
        </form>
        {pending.length > 0 && (
          <ul className="space-y-3">
            {pending.map((i) => (
              <li key={i.token} className="card space-y-2 p-3">
                <div className="flex items-center justify-between text-xs text-muted">
                  <span>
                    {i.group_id ? `Groupe « ${groups.find((g) => g.id === i.group_id)?.name ?? "?"} » · ` : ""}
                    expire le {new Date(i.expires_at).toLocaleDateString("fr-FR")}
                  </span>
                  <form action={deleteInvitation.bind(null, i.token)}>
                    <ConfirmButton message="Supprimer ce lien ?" className="btn-ghost py-1 text-xs">Supprimer</ConfirmButton>
                  </form>
                </div>
                <ShareLink url={`${origin}/invitation/${i.token}`} />
              </li>
            ))}
          </ul>
        )}
        {used.length > 0 && (
          <p className="mt-3 text-xs text-muted">
            Déjà acceptées par : {used.map((i) => member(i.used_by)?.display_name ?? "?").join(", ")}
          </p>
        )}
      </Section>

      <Section
        title="Toute la famille"
        id="membres"
        description="Quelqu'un a oublié son mot de passe ? Crée-lui un lien avec « Mot de passe »."
      >
        {members.length === 0 ? (
          <Empty>Personne pour l&apos;instant.</Empty>
        ) : (
          <ul className="card divide-y divide-line">
            {members.map((m) => {
              const parents = parentLinks.filter((l) => l.child_id === m.id).map((l) => member(l.parent_id)?.display_name);
              return (
                <li key={m.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-sm">
                  <Avatar member={m} size="sm" />
                  <span className="font-bold">{m.display_name}{m.id === me.id && " (moi)"}</span>
                  {m.is_child && <span className="text-xs text-muted">enfant de {parents.join(" et ")}</span>}
                  {!m.is_child && m.id !== me.id && (
                    <div className="ml-auto">
                      <ResetLinkButton name={m.display_name} action={createResetLink.bind(null, m.id)} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Section>
    </>
  );
}
