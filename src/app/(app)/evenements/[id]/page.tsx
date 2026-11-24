import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { IdeaCard } from "@/components/idea-card";
import { Avatar, Empty } from "@/components/ui";
import { formatCountdown, formatDate, isActive, isUuid } from "@/lib/format";
import {
  CONTRIBUTIONS_SQL,
  EVENTS_SQL,
  IDEAS_SQL,
  RESERVE_COUNTS_SQL,
  ideaStatus,
  sortForGiver,
  sortForOwner,
} from "@/lib/ideas";
import { getSession } from "@/lib/session";
import type { Contribution, EventRow, Idea } from "@/lib/types";

export const metadata: Metadata = { title: "Événement" };

export default async function EventPage({ params, searchParams }: PageProps<"/evenements/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const { tx, me, member, isParentOf, childIds } = await getSession();
  if (!isUuid(id)) notFound();

  const data = await tx(async (q) => {
    const [event] = await q<EventRow>(`${EVENTS_SQL} where e.id = $1`, [id]);
    if (!event) return null;
    return {
      event,
      ideas: await q<Idea>(`${IDEAS_SQL} where i.event_id = $1`, [id]),
      contributions: await q<Contribution>(`${CONTRIBUTIONS_SQL} where event_id = $1`, [id]),
      viewable: new Map(
        (await q<{ member_id: string; ok: boolean }>(
          "select member_id, can_view_list(member_id) as ok from event_beneficiaries where event_id = $1",
          [id],
        )).map((r) => [r.member_id, r.ok]),
      ),
      reserve: new Map(
        (await q<{ beneficiary_id: string; n: number }>(RESERVE_COUNTS_SQL, [[me.id, ...childIds]])).map(
          (r) => [r.beneficiary_id, r.n],
        ),
      ),
    };
  });
  if (!data) notFound();
  const { event, ideas, contributions, viewable, reserve } = data;
  const open = isActive(event.event_date);
  const status = (i: Idea) => ideaStatus(i.id, id, contributions, me.id);

  // Les autres d'abord (on vient pour offrir), moi en dernier.
  const people = (event.event_beneficiaries ?? [])
    .map((b) => member(b.member_id))
    .filter((m): m is NonNullable<typeof m> => !!m)
    .sort((a, b) => Number(a.id === me.id) - Number(b.id === me.id) || a.display_name.localeCompare(b.display_name));
  const freeCount = (pid: string) =>
    pid === me.id ? null : ideas.filter((i) => i.beneficiary_id === pid && status(i).total < 100).length;

  const requested = typeof sp.pour === "string" ? sp.pour : null;
  const current =
    people.find((p) => p.id === requested) ??
    people.find((p) => p.id !== me.id && viewable.get(p.id)) ??
    people[0];
  if (!current) notFound();

  const isMe = current.id === me.id;
  const canSee = viewable.get(current.id);
  const canManage = isMe || isParentOf(current.id);
  const back = `/evenements/${id}?pour=${current.id}`;
  const addHref = `/idees/nouvelle?pour=${current.id}&evenement=${id}&back=${encodeURIComponent(back)}`;
  const list = ideas.filter((i) => i.beneficiary_id === current.id);
  const sorted = isMe ? sortForOwner(list) : sortForGiver(list, contributions, me.id);
  const isTaken = (i: Idea) => status(i).total >= 100 && status(i).mine === 0;
  const available = isMe ? sorted : sorted.filter((i) => !isTaken(i));
  const taken = isMe ? [] : sorted.filter(isTaken);
  const nReserve = canManage && open ? (reserve.get(current.id) ?? 0) : 0;

  const card = (idea: Idea) => (
    <IdeaCard
      key={idea.id}
      idea={idea}
      mode={isMe ? "owner" : "giver"}
      status={isMe ? undefined : status(idea)}
      open={open}
      // Ici on offre : l'édition se fait depuis la liste, sauf pour mes propres suggestions secrètes.
      canEdit={open && !isMe && !isParentOf(current.id) && idea.is_secret && idea.created_by === me.id}
      back={back}
      member={member}
    />
  );

  return (
    <>
      <header className="mb-5">
        <Link href="/" className="mb-2 inline-flex text-sm font-semibold text-muted hover:text-ink">← Accueil</Link>
        <div className="band flex items-start justify-between gap-3 rounded-2xl p-5 shadow-sm">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">🎁 {event.name}</h1>
            <p className="text-sm text-band-ink/85">
              {formatDate(event.event_date)} · <span className="font-bold text-accent">{formatCountdown(event.event_date)}</span>
            </p>
          </div>
          {event.created_by === me.id && (
            <Link href={`/evenements/${id}/modifier`} className="shrink-0 rounded-lg px-2 py-1 text-xs font-bold text-band-ink/85 hover:bg-white/10">
              ⚙️ Modifier
            </Link>
          )}
        </div>
      </header>

      {/* Une personne à la fois */}
      <nav className="sticky top-14 z-20 -mx-4 mb-5 flex gap-2 overflow-x-auto border-b-2 border-line bg-paper px-4 py-2.5" aria-label="Pour qui ?">
        {people.map((p) => {
          const active = p.id === current.id;
          const n = viewable.get(p.id) ? freeCount(p.id) : null;
          return (
            <Link
              key={p.id}
              href={`/evenements/${id}?pour=${p.id}`}
              scroll={false}
              aria-current={active ? "page" : undefined}
              className={`flex shrink-0 items-center gap-1.5 rounded-full border py-1 pl-1 pr-3 text-sm font-bold transition ${
                active ? "border-brand-600 bg-brand-600 text-white" : "border-line bg-white hover:border-brand-200"
              }`}
            >
              <Avatar member={p} size="sm" />
              {p.id === me.id ? "Moi" : p.display_name}
              {n !== null && <span className={`text-xs ${active ? "text-brand-100" : "text-muted"}`}>{n}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="section-title">{isMe ? "Ma liste" : `Les idées de ${current.display_name}`}</h2>
        {canSee && open && (
          <Link href={addHref} className="btn-secondary shrink-0 py-2 text-xs">
            {canManage ? "+ Ajouter" : "+ Suggérer une idée"}
          </Link>
        )}
      </div>

      {isMe && (
        <p className="mb-4 rounded-xl bg-stone-100 px-3 py-2 text-sm text-stone-600">
          🤫 Surprise : tu ne vois pas ce que les autres ont choisi pour toi.
        </p>
      )}

      {nReserve > 0 && (
        <Link
          href={`/listes/${current.id}#reserve`}
          className="mb-4 flex items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-100"
        >
          <span>
            📦 {nReserve} idée{nReserve > 1 ? "s" : ""} en réserve{isMe ? "" : ` pour ${current.display_name}`}
          </span>
          <span>Les ajouter ›</span>
        </Link>
      )}

      {!canSee ? (
        <Empty icon="🔒">La liste de {current.display_name} n&apos;est pas partagée avec toi.</Empty>
      ) : list.length === 0 ? (
        <Empty>
          {isMe ? "Tu n'as pas encore d'idée pour cet événement." : `${current.display_name} n'a pas encore d'idée ici.`}
          {open && (
            <div className="mt-3">
              <Link href={addHref} className="btn-primary">{canManage ? "Ajouter une idée" : "Suggérer une idée"}</Link>
            </div>
          )}
        </Empty>
      ) : (
        <div className="space-y-3">
          {available.length === 0 && <Empty icon="🎉">Toutes les idées de {current.display_name} sont déjà choisies.</Empty>}
          {available.map(card)}
          {taken.length > 0 && (
            <details className="pt-2">
              <summary className="cursor-pointer text-sm font-bold text-muted hover:text-ink">
                Déjà choisies par d&apos;autres ({taken.length}) ▾
              </summary>
              <div className="mt-3 space-y-3 opacity-70">{taken.map(card)}</div>
            </details>
          )}
        </div>
      )}

      {canManage && !isMe && (
        <p className="mt-6 text-center text-sm">
          <Link href={`/listes/${current.id}`} className="font-bold text-brand-600">
            Gérer la liste de {current.display_name} ›
          </Link>
        </p>
      )}
      {isMe && list.length > 0 && (
        <p className="mt-6 text-center text-sm">
          <Link href={`/listes/${me.id}`} className="font-bold text-brand-600">Modifier ma liste ›</Link>
        </p>
      )}
    </>
  );
}
