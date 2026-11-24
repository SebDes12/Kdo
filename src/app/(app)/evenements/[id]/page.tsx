import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { IdeaCard } from "@/components/idea-card";
import { Avatar, Badge, Empty, PageHeader } from "@/components/ui";
import { formatCountdown, formatDate, isActive, isUuid } from "@/lib/format";
import { CONTRIBUTIONS_SQL, EVENTS_SQL, IDEAS_SQL, ideaStatus, sortForGiver, sortForOwner } from "@/lib/ideas";
import { getSession } from "@/lib/session";
import type { Contribution, EventRow, Idea } from "@/lib/types";

export const metadata: Metadata = { title: "Événement" };

export default async function EventPage({ params }: PageProps<"/evenements/[id]">) {
  const { id } = await params;
  const { tx, me, member, isParentOf } = await getSession();
  if (!isUuid(id)) notFound();

  const data = await tx(async (q) => {
    const [event] = await q<EventRow>(`${EVENTS_SQL} where e.id = $1`, [id]);
    if (!event) return null;
    return {
      event,
      ideas: await q<Idea>(`${IDEAS_SQL} where i.event_id = $1`, [id]),
      contributions: await q<Contribution>(`${CONTRIBUTIONS_SQL} where event_id = $1`, [id]),
      // Listes visibles : la base le dit pour chaque bénéficiaire
      viewable: new Map(
        (await q<{ member_id: string; ok: boolean }>(
          "select member_id, can_view_list(member_id) as ok from event_beneficiaries where event_id = $1",
          [id],
        )).map((r) => [r.member_id, r.ok]),
      ),
    };
  });
  if (!data) notFound();
  const { event, ideas, contributions, viewable } = data;
  const open = isActive(event.event_date);

  // Moi d'abord ? Non : la personne qui offre veut voir les autres en premier.
  const beneficiaries = (event.event_beneficiaries ?? [])
    .map((b) => member(b.member_id))
    .filter((m): m is NonNullable<typeof m> => !!m)
    .sort((a, b) => Number(a.id === me.id) - Number(b.id === me.id) || a.display_name.localeCompare(b.display_name));
  const back = `/evenements/${id}`;

  return (
    <>
      <PageHeader
        back={{ href: "/", label: "Accueil" }}
        title={event.name}
        subtitle={
          <>
            {formatDate(event.event_date)} · <span className="font-bold text-brand-600">{formatCountdown(event.event_date)}</span>
          </>
        }
        action={
          event.created_by === me.id && (
            <Link href={`/evenements/${id}/modifier`} className="btn-secondary shrink-0">Modifier</Link>
          )
        }
      />

      {beneficiaries.length > 1 && (
        <nav className="sticky top-14 z-20 -mx-4 mb-6 flex gap-2 overflow-x-auto border-b border-line bg-paper/90 px-4 py-2 backdrop-blur">
          {beneficiaries.map((b) => (
            <a key={b.id} href={`#pour-${b.id}`} className="flex shrink-0 items-center gap-1.5 rounded-full border border-line bg-white py-1 pl-1 pr-3 text-sm font-bold hover:border-brand-200">
              <Avatar member={b} size="sm" />
              {b.id === me.id ? "Moi" : b.display_name}
            </a>
          ))}
        </nav>
      )}

      {beneficiaries.map((b) => {
        const isMe = b.id === me.id;
        const canSee = viewable.get(b.id);
        const canManage = isMe || isParentOf(b.id);
        const list = ideas.filter((i) => i.beneficiary_id === b.id);
        const sorted = isMe ? sortForOwner(list) : sortForGiver(list, contributions, me.id);
        const free = isMe ? 0 : list.filter((i) => ideaStatus(i.id, id, contributions, me.id).total < 100).length;
        const addHref = `/idees/nouvelle?pour=${b.id}&evenement=${id}&back=${encodeURIComponent(back + "#pour-" + b.id)}`;

        return (
          <section key={b.id} id={`pour-${b.id}`} className="mb-10 scroll-mt-32">
            <div className="mb-3 flex items-center gap-3">
              <Avatar member={b} size="lg" />
              <div className="min-w-0 flex-1">
                <h2 className="text-xl font-extrabold">{isMe ? "Ma liste" : `Pour ${b.display_name}`}</h2>
                {canSee && !isMe && (
                  <p className="text-sm text-muted">
                    {list.length} idée{list.length > 1 ? "s" : ""} · {free} disponible{free > 1 ? "s" : ""}
                  </p>
                )}
                {isMe && <p className="text-sm text-muted">Tu ne vois pas ce que les autres ont choisi : surprise ! 🤫</p>}
              </div>
              {canSee && open && (
                <Link href={addHref} className="btn-secondary shrink-0 text-xs">
                  {canManage ? "+ Ajouter" : "+ Suggérer"}
                </Link>
              )}
            </div>

            {!canSee ? (
              <Empty icon="🔒">La liste de {b.display_name} n&apos;est pas partagée avec toi.</Empty>
            ) : sorted.length === 0 ? (
              <Empty>
                {isMe ? "Ta liste est vide pour cet événement." : `${b.display_name} n'a pas encore d'idée ici.`}
                {open && (
                  <div className="mt-3">
                    <Link href={addHref} className="btn-primary">
                      {canManage ? "Ajouter une idée" : "Suggérer une idée"}
                    </Link>
                  </div>
                )}
              </Empty>
            ) : (
              <div className="space-y-3">
                {sorted.map((idea) => (
                  <IdeaCard
                    key={idea.id}
                    idea={idea}
                    mode={isMe ? "owner" : "giver"}
                    status={isMe ? undefined : ideaStatus(idea.id, id, contributions, me.id)}
                    open={open}
                    canEdit={open && (canManage ? !(isMe && idea.is_secret) : idea.is_secret && idea.created_by === me.id)}
                    back={back + "#pour-" + b.id}
                    member={member}
                  />
                ))}
              </div>
            )}
            {!open && canSee && !isMe && (
              <p className="mt-3"><Badge>Événement terminé : les choix sont figés</Badge></p>
            )}
          </section>
        );
      })}
    </>
  );
}
