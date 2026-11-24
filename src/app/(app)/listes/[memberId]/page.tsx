import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { moveIdea } from "@/app/actions/ideas";
import { IdeaCard } from "@/components/idea-card";
import { SubmitButton } from "@/components/client";
import { Avatar, Empty } from "@/components/ui";
import { eventCountdown, isOpen } from "@/lib/format";
import { CONTRIBUTIONS_SQL, EVENTS_SQL, IDEAS_SQL, ideaStatus, memberInEvent, sortForOwner } from "@/lib/ideas";
import { getSession } from "@/lib/session";
import type { Contribution, EventRow, Idea } from "@/lib/types";

export const metadata: Metadata = { title: "Liste" };

export default async function ListPage({ params }: PageProps<"/listes/[memberId]">) {
  const { memberId } = await params;
  const { tx, me, member, canManageList, children } = await getSession();
  const owner = member(memberId);
  if (!owner || !canManageList(memberId)) notFound();
  const isMe = owner.id === me.id;
  const back = `/listes/${memberId}`;

  const { ideas, events, contributions } = await tx(async (q) => ({
    ideas: await q<Idea>(`${IDEAS_SQL} where i.beneficiary_id = $1 and i.deleted_at is null`, [memberId]),
    events: await q<EventRow>(
      `${EVENTS_SQL}
       where ${memberInEvent("$1")}
          or e.id in (select event_id from ideas where beneficiary_id = $1)
       order by e.event_date`,
      [memberId],
    ),
    contributions: await q<Contribution>(
      `${CONTRIBUTIONS_SQL} where idea_id in (select id from ideas where beneficiary_id = $1)`,
      [memberId],
    ),
  }));
  const upcoming = events.filter((e) => isOpen(e));
  const eventById = new Map(events.map((e) => [e.id, e]));

  // En réserve : sans événement, ou rattachées à un événement passé.
  const reserve = sortForOwner(ideas.filter((i) => !i.event_id || !upcoming.some((e) => e.id === i.event_id)));
  const addHref = `/idees/nouvelle?pour=${memberId}&back=${encodeURIComponent(back)}`;

  const card = (idea: Idea, footer?: React.ReactNode) => (
    <IdeaCard
      key={idea.id}
      idea={idea}
      // Mes idées : aucun état visible. Liste d'un enfant : le parent voit l'état, sans bouton d'achat.
      mode={isMe ? "owner" : "manage"}
      status={isMe ? undefined : ideaStatus(idea.id, idea.event_id, contributions, me.id)}
      open={false}
      canEdit
      back={back}
      member={member}
      footer={footer}
    />
  );

  return (
    <>
      {children.length > 0 && (
        <nav className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-1" aria-label="Choisir la liste">
          {[me, ...children].map((m) => (
            <Link
              key={m.id}
              href={`/listes/${m.id}`}
              aria-current={m.id === owner.id ? "page" : undefined}
              className={`flex shrink-0 items-center gap-1.5 rounded-full border py-1 pl-1 pr-3 text-sm font-bold ${
                m.id === owner.id ? "border-brand-600 bg-brand-600 text-white" : "border-line bg-white hover:border-brand-200"
              }`}
            >
              <Avatar member={m} size="sm" />
              {m.id === me.id ? "Moi" : m.display_name}
            </Link>
          ))}
        </nav>
      )}

      <header className="mb-6 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold tracking-tight">{isMe ? "Ma liste" : `Liste de ${owner.display_name}`}</h1>
          <p className="text-sm text-muted">
            {isMe ? "🤫 Tu ne verras jamais ce qui a été choisi." : `Toi, tu vois ce qui a été choisi ; ${owner.display_name}, non.`}
          </p>
        </div>
        <Link href={addHref} className="btn-primary shrink-0">+ Ajouter une idée</Link>
      </header>

      {upcoming.length === 0 && reserve.length === 0 && (
        <Empty icon="📝">
          Aucune idée pour l&apos;instant.
          <div className="mt-3">
            <Link href={addHref} className="btn-primary">Ajouter une idée</Link>
          </div>
        </Empty>
      )}

      {upcoming.map((e) => {
        const list = sortForOwner(ideas.filter((i) => i.event_id === e.id));
        return (
          <section key={e.id} className="mb-8">
            <h2 className="section-title mb-3 flex items-baseline gap-2">
              <Link href={`/evenements/${e.id}`} className="hover:text-brand-600">{e.name}</Link>
              <span className="text-sm font-bold text-brand-600">{eventCountdown(e)}</span>
            </h2>
            {list.length === 0 ? (
              <p className="rounded-xl border border-dashed border-line px-4 py-3 text-sm text-muted">
                Aucune idée pour cet événement.{" "}
                <Link
                  href={`/idees/nouvelle?pour=${memberId}&evenement=${e.id}&back=${encodeURIComponent(back)}`}
                  className="font-bold text-brand-600"
                >
                  En ajouter une
                </Link>
              </p>
            ) : (
              <div className="space-y-3">{list.map((i) => card(i))}</div>
            )}
          </section>
        );
      })}

      {reserve.length > 0 && (
        <section id="reserve" className="mb-8 scroll-mt-20">
          <h2 className="section-title">📦 En réserve</h2>
          <p className="mb-3 text-sm text-muted">
            {upcoming.length > 0 ? "Pas encore rattachées à un événement : ajoute-les en un clic." : "Elles attendent le prochain événement."}
          </p>
          <div className="space-y-3">
            {reserve.map((i) => {
              const from = i.event_id ? eventById.get(i.event_id) : undefined;
              return card(
                i,
                <>
                  {from && <span className="text-xs text-muted">De « {from.name} »</span>}
                  {upcoming.length > 0 && (
                    <form action={moveIdea} className="ml-auto flex items-center gap-1">
                      <input type="hidden" name="idea" value={i.id} />
                      <input type="hidden" name="back" value={back} />
                      {upcoming.length > 1 ? (
                        <select name="event" className="field py-1 text-xs" aria-label="Événement" defaultValue={upcoming[0].id}>
                          {upcoming.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                        </select>
                      ) : (
                        <input type="hidden" name="event" value={upcoming[0].id} />
                      )}
                      <SubmitButton className="btn-secondary py-1 text-xs">
                        {upcoming.length > 1 ? "Ajouter" : `Ajouter à ${upcoming[0].name}`}
                      </SubmitButton>
                    </form>
                  )}
                </>,
              );
            })}
          </div>
        </section>
      )}

      <p className="mb-8 text-center text-sm text-muted">
        {isMe && "Tes idées rattachées à un événement sont visibles par les membres de ses groupes (jamais par toi-même)."}
        {!isMe && (
          <Link href={`/famille/enfants/${owner.id}`} className="font-bold text-brand-600">
            Réglages de {owner.display_name} (connexion, qui voit sa liste)
          </Link>
        )}
      </p>
    </>
  );
}
