import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { addGroupMember, deleteGroup, removeGroupMember, renameGroup } from "@/app/actions/family";
import { ConfirmButton, SubmitButton } from "@/components/client";
import { Avatar, PageHeader, Section } from "@/components/ui";
import { getSession } from "@/lib/session";
import { loadSharing } from "../../load";

export const metadata: Metadata = { title: "Groupe" };

export default async function GroupPage({ params }: PageProps<"/famille/groupes/[id]">) {
  const { id } = await params;
  const session = await getSession();
  const { me, members, member } = session;
  const { groups, groupMembers, shares } = await loadSharing(session);
  const group = groups.find((g) => g.id === id);
  if (!group) notFound();

  const isCreator = group.created_by === me.id;
  const memberIds = groupMembers.filter((gm) => gm.group_id === id).map((gm) => gm.member_id);
  const isMember = memberIds.includes(me.id);
  const others = members.filter((m) => !memberIds.includes(m.id));
  const sharedLists = shares.filter((s) => s.group_id === id).map((s) => member(s.owner_id)).filter(Boolean);

  return (
    <>
      <PageHeader
        back={{ href: "/famille", label: "Famille" }}
        title={`👥 ${group.name}`}
        subtitle={`Créé par ${member(group.created_by)?.display_name ?? "?"}`}
      />

      {isCreator && (
        <Section title="Nom">
          <form action={renameGroup.bind(null, id)} className="card flex gap-2 p-4">
            <input name="name" className="field" defaultValue={group.name} required maxLength={60} aria-label="Nom" />
            <SubmitButton className="btn-secondary shrink-0">Renommer</SubmitButton>
          </form>
        </Section>
      )}

      <Section title={`Membres (${memberIds.length})`}>
        <ul className="card mb-3 divide-y divide-line">
          {memberIds.map((mid) => {
            const m = member(mid);
            return (
              <li key={mid} className="flex items-center gap-3 px-4 py-3">
                <Avatar member={m} size="sm" />
                <span className="flex-1 font-bold">{m?.display_name}{mid === me.id && " (moi)"}</span>
                {(isCreator || mid === me.id) && (
                  <form action={removeGroupMember.bind(null, id, mid)}>
                    <ConfirmButton
                      message={mid === me.id ? "Quitter ce groupe ?" : `Retirer ${m?.display_name} du groupe ?`}
                      className="btn-ghost py-1 text-xs"
                    >
                      {mid === me.id ? "Quitter" : "Retirer"}
                    </ConfirmButton>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
        {(isCreator || isMember) && others.length > 0 && (
          <form action={addGroupMember.bind(null, id)} className="flex gap-2">
            <select name="member" className="field" required aria-label="Ajouter un membre">
              {others.map((m) => <option key={m.id} value={m.id}>{m.display_name}</option>)}
            </select>
            <SubmitButton className="btn-secondary shrink-0">+ Ajouter</SubmitButton>
          </form>
        )}
      </Section>

      <Section title="Listes partagées avec ce groupe">
        <p className="text-sm text-muted">
          {sharedLists.length ? sharedLists.map((m) => m!.display_name).join(", ") : "Aucune liste pour l'instant."}
        </p>
      </Section>

      {isCreator && (
        <form action={deleteGroup.bind(null, id)} className="border-t border-line pt-6">
          <ConfirmButton message="Supprimer ce groupe ? Les listes partagées avec lui ne le seront plus.">Supprimer le groupe</ConfirmButton>
        </form>
      )}
    </>
  );
}
