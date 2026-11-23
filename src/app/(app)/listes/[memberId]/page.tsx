import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { moveIdea } from "@/app/actions/ideas";
import { IdeaCard } from "@/components/idea-card";
import { SubmitButton } from "@/components/client";
import { Avatar, Empty, Notice, PageHeader, Section } from "@/components/ui";
import { formatCountdown, formatDate, isActive } from "@/lib/format";
import { IDEA_SELECT, ideaStatus, sortForGiver, sortForOwner } from "@/lib/ideas";
import { getSession } from "@/lib/session";
import type { Contribution, EventRow, Idea } from "@/lib/types";

export const metadata: Metadata = { title: "Liste" };

export default async function ListPage({ params }: PageProps<"/listes/[memberId]">) {
  const { memberId } = await params;
  const { supabase, me, member, canManageList } = await getSession();
  const owner = member(memberId);
  if (!owner || !canManageList(memberId)) notFound();
  const isMe = owner.id === me.id;
  const back = `/listes/${memberId}`;

  const [{ data: ideaRows }, { data: evRows }, { data: contribRows }] = await Promise.all([
    supabase.from("ideas").select(IDEA_SELECT).eq("beneficiary_id", memberId),
    supabase
      .from("events")
      .select("id, name, event_date, created_by, event_beneficiaries!inner(member_id)")
      .eq("event_beneficiaries.member_id", memberId)
      .order("event_date"),
    supabase.from("contributions").select("idea_id, event_id, member_id, percent"),
  ]);
  const ideas = (ideaRows ?? []) as Idea[];
  const events = (evRows ?? []) as EventRow[];
  const contributions = (contribRows ?? []) as Contribution[];
  const upcoming = events.filter((e) => isActive(e.event_date));
  const eventById = new Map(events.map((e) => [e.id, e]));

  // En réserve : sans événement, ou rattachées à un événement passé.
  const reserve = ideas.filter((i) => !i.event_id || !upcoming.some((e) => e.id === i.event_id));
  const sort = (list: Idea[]) => (isMe ? sortForOwner(list) : sortForGiver(list, contributions, me.id));

  const card = (idea: Idea, open: boolean, footer?: React.ReactNode) => (
    <IdeaCard
      key={idea.id}
      idea={idea}
      mode={isMe ? "owner" : "giver"}
      status={isMe ? undefined : ideaStatus(idea.id, idea.event_id, contributions, me.id)}
      open={open}
      canEdit
      back={back}
      member={member}
      footer={footer}
    />
  );

  return (
    <>
      <PageHeader
        title={isMe ? "Ma liste" : `Liste de ${owner.display_name}`}
        subtitle={isMe ? "Ajoute tes idées : tu ne verras jamais ce qui a été choisi." : "Tu gères cette liste en tant que parent."}
        action={
          !isMe && (
            <Link href={`/famille/enfants/${owner.id}`} className="btn-secondary shrink-0">Réglages</Link>
          )
        }
      />

      {upcoming.length === 0 && (
        <Notice tone="info">
          {isMe ? "Tu n'es" : `${owner.display_name} n'est`} bénéficiaire d&apos;aucun événement à venir. Tu peux quand même
          noter des idées : elles restent en réserve.
        </Notice>
      )}

      {upcoming.map((e) => {
        const list = sort(ideas.filter((i) => i.event_id === e.id));
        return (
          <Section
            key={e.id}
            title={
              <Link href={`/evenements/${e.id}`} className="hover:text-brand-600">
                {e.name} <span className="text-sm font-bold text-brand-600">· {formatCountdown(e.event_date)}</span>
              </Link>
            }
            description={formatDate(e.event_date)}
            action={
              <Link
                href={`/idees/nouvelle?pour=${memberId}&evenement=${e.id}&back=${encodeURIComponent(back)}`}
                className="btn-primary shrink-0 py-2 text-xs"
              >
                + Ajouter
              </Link>
            }
          >
            {list.length === 0 ? (
              <Empty>Aucune idée pour l&apos;instant.</Empty>
            ) : (
              <div className="space-y-3">{list.map((i) => card(i, true))}</div>
            )}
          </Section>
        );
      })}

      <Section
        title="En réserve"
        description="Idées sans événement ou d'un événement passé. Reporte-les sur un prochain événement."
        action={
          <Link href={`/idees/nouvelle?pour=${memberId}&back=${encodeURIComponent(back)}`} className="btn-secondary shrink-0 py-2 text-xs">
            + Ajouter
          </Link>
        }
      >
        {reserve.length === 0 ? (
          <Empty icon="📦">Rien en réserve.</Empty>
        ) : (
          <div className="space-y-3">
            {sort(reserve).map((i) => {
              const from = i.event_id ? eventById.get(i.event_id) : undefined;
              return card(
                i,
                false,
                <>
                  <span className="px-2 text-xs text-muted">{from ? `${from.name} (passé)` : "Sans événement"}</span>
                  {upcoming.length > 0 && (
                    <form action={moveIdea} className="flex items-center gap-1">
                      <input type="hidden" name="idea" value={i.id} />
                      <input type="hidden" name="back" value={back} />
                      <select name="event" className="field py-1 text-xs" aria-label="Reporter vers" defaultValue={upcoming[0].id}>
                        {upcoming.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                      </select>
                      <SubmitButton className="btn-secondary py-1 text-xs">Reporter</SubmitButton>
                    </form>
                  )}
                </>,
              );
            })}
          </div>
        )}
      </Section>

      {isMe && !me.is_child && (
        <p className="mb-8 text-center text-sm text-muted">
          <Avatar member={me} size="sm" /> Qui voit ta liste ?{" "}
          <Link href="/famille#visibilite" className="font-bold text-brand-600">Régler la visibilité</Link>
        </p>
      )}
    </>
  );
}
