import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createChild, createGroup, createInvitation, createResetLink, deleteInvitation } from "@/app/actions/family";
import { ConfirmButton, LinkButton, ShareLink, SubmitButton } from "@/components/client";
import { Avatar, Badge, Empty, Notice, PageHeader, Reveal, Section } from "@/components/ui";
import { getSession } from "@/lib/session";
import { loadGroups } from "./load";

export const metadata: Metadata = { title: "Famille" };

export default async function FamilyPage({ searchParams }: PageProps<"/famille">) {
  const sp = await searchParams;
  const session = await getSession();
  const { q, me, members, children, parentLinks, member } = session;
  if (me.is_child) redirect("/");

  const [{ groups, groupMembers }, invRows] = await Promise.all([
    loadGroups(session),
    q(
      `select i.token, i.expires_at, i.used_at, i.used_by,
              coalesce(array_agg(ig.group_id) filter (where ig.group_id is not null), '{}') as group_ids
       from invitations i left join invitation_groups ig on ig.token = i.token
       group by i.token order by i.created_at desc`,
    ),
  ]);
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
  const invitations = (invRows ?? []) as { token: string; group_ids: string[]; expires_at: string; used_at: string | null; used_by: string | null }[];
  const pending = invitations.filter((i) => !i.used_at && new Date(i.expires_at) > new Date());
  const used = invitations.filter((i) => i.used_at).slice(0, 5);
  const myGroups = groups.filter((g) => groupMembers.some((gm) => gm.group_id === g.id && gm.member_id === me.id));

  return (
    <>
      <PageHeader title="Famille" subtitle="Groupes, invitations et enfants." />

      {sp.bienvenue && (
        <Notice tone="ok">
          Bienvenue ! Pour démarrer : crée un groupe (ex. « Toute la famille »), invite les autres avec un lien, ajoute tes enfants puis crée un événement.
        </Notice>
      )}

      <details className="mb-8 text-sm text-muted">
        <summary className="cursor-pointer font-bold hover:text-ink">💡 Comment ça marche ?</summary>
        <p className="mt-2">
          Un événement est rattaché à un ou plusieurs groupes. Tous leurs membres le voient et peuvent y ajouter leur liste
          d&apos;idées, visible par les membres de ces groupes, jamais par la personne qui reçoit.
        </p>
      </details>

      <Section title="Mes enfants" id="enfants">
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
          <Reveal label="+ Ajouter un enfant">
            <form action={createChild} className="card grid gap-2 p-3 sm:grid-cols-[1fr_1fr_auto]">
              <input name="name" className="field" placeholder="Prénom de l'enfant" required maxLength={60} aria-label="Prénom de l'enfant" />
              <select name="coparent" className="field" aria-label="Autre parent (facultatif)" defaultValue="">
                <option value="">Autre parent (facultatif)</option>
                {members
                  .filter((m) => !m.is_child && m.id !== me.id)
                  .map((m) => <option key={m.id} value={m.id}>Avec {m.display_name}</option>)}
              </select>
              <SubmitButton className="btn-primary">Ajouter</SubmitButton>
            </form>
            <p className="mt-2 text-xs text-muted">
              Déjà ajouté par l&apos;autre parent ? Ne le recrée pas : demande-lui de t&apos;ajouter sur la fiche de
              l&apos;enfant (section « Parents »).
            </p>
          </Reveal>
        </div>
      </Section>

      <Section title="Groupes" id="groupes">
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
                      {groupMembers.some((x) => x.group_id === g.id && x.member_id === me.id && x.is_admin) ? (
                        <Badge tone="violet">admin</Badge>
                      ) : (
                        myGroups.includes(g) && <Badge tone="brand">membre</Badge>
                      )}
                      <span className="text-muted">›</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
          <Reveal label="+ Créer un groupe">
            <form action={createGroup} className="flex gap-2">
              <input name="name" className="field" placeholder="Ex. : Côté papa, Cousins…" required maxLength={60} aria-label="Nom du groupe" />
              <SubmitButton className="btn-primary shrink-0">Créer</SubmitButton>
            </form>
          </Reveal>
        </div>
      </Section>

      <Section title="Invitations" id="invitations">
        <Reveal label="+ Inviter quelqu'un" primary>
        <form action={createInvitation} className="card mb-4 space-y-3 p-4">
          {myGroups.length > 0 && (
            <fieldset>
              <legend className="label">La personne rejoindra les groupes :</legend>
              <div className="flex flex-wrap gap-2">
                {myGroups.map((g) => (
                  <label
                    key={g.id}
                    className="flex cursor-pointer items-center gap-2 rounded-full border-2 border-line bg-white px-3 py-1.5 text-sm font-bold has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50 has-[:checked]:text-brand-700"
                  >
                    <input type="checkbox" name="groups" value={g.id} defaultChecked={myGroups.length === 1} className="size-4 accent-brand-600" />
                    👥 {g.name}
                  </label>
                ))}
              </div>
              <p className="hint">Coche un ou plusieurs groupes (ou aucun).</p>
            </fieldset>
          )}
          <SubmitButton className="btn-primary w-full sm:w-auto">Créer un lien d&apos;invitation</SubmitButton>
          <p className="hint">Le lien sert une seule fois et expire après 14 jours.</p>
        </form>
        </Reveal>
        {pending.length > 0 && (
          <ul className="mt-3 space-y-3">
            {pending.map((i) => (
              <li key={i.token} className="card space-y-2 p-3">
                <div className="flex items-center justify-between text-xs text-muted">
                  <span>
                    {i.group_ids.length
                      ? `${i.group_ids.length > 1 ? "Groupes" : "Groupe"} ${i.group_ids
                          .map((gid) => `« ${groups.find((g) => g.id === gid)?.name ?? "?"} »`)
                          .join(", ")} · `
                      : ""}
                    expire le {new Date(i.expires_at).toLocaleDateString("fr-FR")}
                  </span>
                  <form action={deleteInvitation.bind(null, i.token)}>
                    <ConfirmButton
                      title="Supprimer ce lien d'invitation ?"
                      message="Il ne pourra plus être utilisé."
                      confirmLabel="Supprimer"
                      className="btn-ghost py-1 text-xs"
                    >
                      Supprimer
                    </ConfirmButton>
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
        description="Mot de passe oublié ? « 🔑 Mot de passe » crée un lien à lui envoyer."
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
                      <LinkButton
                        label="🔑 Mot de passe"
                        title={`Nouveau mot de passe pour ${m.display_name} ?`}
                        message="Tu vas obtenir un lien à lui envoyer (valable 2 jours). Son mot de passe actuel reste valable jusqu'à ce qu'il en choisisse un nouveau."
                        confirmLabel="Créer le lien"
                        shareText={`Envoie ce lien à ${m.display_name} (valable 2 jours, une seule fois) :`}
                        action={createResetLink.bind(null, m.id)}
                      />
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
