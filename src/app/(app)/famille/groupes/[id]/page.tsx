import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { restoreEvent } from "@/app/actions/events";
import {
  addGroupMember,
  deleteGroup,
  removeGroupMember,
  renameGroup,
  setEventCreation,
  setGroupAdmin,
} from "@/app/actions/family";
import { ConfirmButton, SubmitButton } from "@/components/client";
import { Avatar, Badge, PageHeader, Section } from "@/components/ui";
import { formatDay, formatPeriod, isOpen } from "@/lib/format";
import { EVENTS_SQL } from "@/lib/ideas";
import { getSession } from "@/lib/session";
import type { EventRow } from "@/lib/types";
import { loadGroups } from "../../load";

export const metadata: Metadata = { title: "Groupe" };

export default async function GroupPage({ params }: PageProps<"/famille/groupes/[id]">) {
  const { id } = await params;
  const session = await getSession();
  const { me, members, member } = session;
  const { groups, groupMembers } = await loadGroups(session);
  const group = groups.find((g) => g.id === id);
  if (!group) notFound();
  // Événements du groupe (la corbeille n'est visible que de ceux qui peuvent restaurer)
  const events = await session.q<EventRow>(
    `${EVENTS_SQL} where exists (select 1 from event_groups eg where eg.event_id = e.id and eg.group_id = $1)
     order by e.event_date desc`,
    [id],
  );
  const live = events.filter((e) => !e.deleted_at);
  const trash = events.filter((e) => e.deleted_at);

  const rows = groupMembers.filter((gm) => gm.group_id === id);
  const isAdmin = rows.some((gm) => gm.member_id === me.id && gm.is_admin);
  const isMember = rows.some((gm) => gm.member_id === me.id);
  const others = members.filter((m) => !rows.some((gm) => gm.member_id === m.id));

  return (
    <>
      <PageHeader
        back={{ href: "/famille", label: "Famille" }}
        title={`👥 ${group.name}`}
        subtitle={isAdmin ? "Tu es administrateur de ce groupe." : undefined}
      />

      <Section title={`Membres (${rows.length})`}>
        <ul className="card mb-3 divide-y divide-line">
          {rows.map((gm) => {
            const m = member(gm.member_id);
            const isMe = gm.member_id === me.id;
            return (
              <li key={gm.member_id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5">
                <Avatar member={m} size="sm" />
                <span className="font-bold">{m?.display_name}{isMe && " (moi)"}</span>
                {gm.is_admin && <Badge tone="violet">admin</Badge>}
                <div className="ml-auto flex items-center gap-1">
                  {isAdmin && !m?.is_child && (
                    <form action={setGroupAdmin.bind(null, id, gm.member_id, !gm.is_admin)}>
                      <SubmitButton className="btn-ghost py-1 text-xs">
                        {gm.is_admin ? "Retirer admin" : "Nommer admin"}
                      </SubmitButton>
                    </form>
                  )}
                  {(isAdmin || isMe) && (
                    <form action={removeGroupMember.bind(null, id, gm.member_id)}>
                      <ConfirmButton
                        title={isMe ? "Quitter ce groupe ?" : `Retirer ${m?.display_name} du groupe ?`}
                        message={isMe ? "Tu ne verras plus ses événements." : "Il ne verra plus les événements du groupe."}
                        confirmLabel={isMe ? "Quitter" : "Retirer"}
                        className="btn-ghost py-1 text-xs"
                      >
                        {isMe ? "Quitter" : "Retirer"}
                      </ConfirmButton>
                    </form>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
        {(isAdmin || isMember) && others.length > 0 && (
          <form action={addGroupMember.bind(null, id)} className="flex gap-2">
            <select name="member" className="field" required aria-label="Ajouter un membre">
              {others.map((m) => <option key={m.id} value={m.id}>{m.display_name}</option>)}
            </select>
            <SubmitButton className="btn-secondary shrink-0">+ Ajouter</SubmitButton>
          </form>
        )}
      </Section>

      <Section title="Événements">
        {live.length === 0 ? (
          <p className="text-sm text-muted">Aucun événement pour l&apos;instant.</p>
        ) : (
          <ul className="card divide-y divide-line">
            {live.map((e) => (
              <li key={e.id}>
                <Link href={`/evenements/${e.id}`} className="flex justify-between gap-3 px-4 py-2.5 text-sm hover:bg-brand-50">
                  <span className={`font-bold ${isOpen(e) ? "" : "text-muted"}`}>{e.name}</span>
                  <span className="text-muted">{formatPeriod(e)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {trash.length > 0 && (
        <Section title="🗑 Corbeille" description="Événements supprimés, restaurables pendant 30 jours.">
          <ul className="card divide-y divide-line">
            {trash.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <span>
                  <strong>{e.name}</strong>{" "}
                  <span className="text-muted">
                    · supprimé le {formatDay(e.deleted_at)} par {member(e.deleted_by)?.display_name ?? "?"}
                  </span>
                </span>
                <form action={restoreEvent.bind(null, e.id)}>
                  <SubmitButton className="btn-secondary py-1 text-xs">↩️ Restaurer</SubmitButton>
                </form>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {isAdmin && (
        <details className="mb-10">
          <summary className="cursor-pointer text-sm font-bold text-muted hover:text-ink">⚙️ Réglages du groupe ▾</summary>
          <div className="mt-4 space-y-4">
            <form action={setEventCreation.bind(null, id)} className="card space-y-3 p-4">
              <p className="label">Qui peut créer des événements pour ce groupe ?</p>
              {[
                { v: "members", l: "Tous les membres" },
                { v: "admins", l: "Seulement les administrateurs" },
              ].map((o) => (
                <label key={o.v} className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="event_creation"
                    value={o.v}
                    defaultChecked={(group.event_creation ?? "members") === o.v}
                    className="size-4 accent-brand-600"
                  />
                  {o.l}
                </label>
              ))}
              <SubmitButton className="btn-secondary py-1.5 text-xs">Enregistrer</SubmitButton>
            </form>

            <form action={renameGroup.bind(null, id)} className="card flex gap-2 p-4">
              <input name="name" className="field" defaultValue={group.name} required maxLength={60} aria-label="Nom du groupe" />
              <SubmitButton className="btn-secondary shrink-0">Renommer</SubmitButton>
            </form>

            <form action={deleteGroup.bind(null, id)}>
              <ConfirmButton
                title={`Supprimer le groupe « ${group.name} » ?`}
                message="Ses membres ne verront plus les événements rattachés uniquement à ce groupe."
                confirmLabel="Supprimer"
              >
                Supprimer le groupe
              </ConfirmButton>
            </form>
          </div>
        </details>
      )}
    </>
  );
}
