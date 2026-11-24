import Link from "next/link";
import { IdeaCard } from "@/components/idea-card";
import { Avatar, Empty } from "@/components/ui";
import { formatCountdown, formatDate, isActive } from "@/lib/format";
import {
  CONTRIBUTIONS_SQL,
  EVENTS_SQL,
  IDEAS_SQL,
  RESERVE_COUNTS_SQL,
  ideaStatus,
  sortForGiver,
} from "@/lib/ideas";
import { getSession } from "@/lib/session";
import type { Contribution, EventRow, Idea } from "@/lib/types";

/**
 * Accueil = « offrir un cadeau » : toutes les idées des événements à venir,
 * directement avec le bouton « Je le prends ».
 */
export default async function HomePage({ searchParams }: PageProps<"/">) {
  const sp = await searchParams;
  const { tx, me, member, children, isParentOf } = await getSession();

  const { events, ideas, contributions, reserve, chosen, viewable } = await tx(async (q) => ({
    viewable: new Set(
      (
        await q<{ member_id: string }>(
          `select distinct b.member_id from event_beneficiaries b join events e on e.id = b.event_id
           where e.event_date >= current_date and can_view_list(b.member_id)`,
        )
      ).map((r) => r.member_id),
    ),
    events: await q<EventRow>(`${EVENTS_SQL} order by e.event_date`),
    // Idées des autres sur les événements à venir (la base ne renvoie que les listes partagées avec moi)
    ideas: await q<Idea>(
      `${IDEAS_SQL}
       where i.beneficiary_id <> $1
         and i.event_id in (select id from events where event_date >= current_date)`,
      [me.id],
    ),
    contributions: await q<Contribution>(
      `${CONTRIBUTIONS_SQL} where event_id in (select id from events where event_date >= current_date)`,
    ),
    reserve: (await q<{ n: number }>(RESERVE_COUNTS_SQL, [[me.id, ...children.map((c) => c.id)]])).reduce(
      (s, r) => s + r.n,
      0,
    ),
    chosen: (
      await q<{ n: number }>(
        `select count(*)::int as n from contributions c join events e on e.id = c.event_id
         where c.member_id = $1 and e.event_date >= current_date`,
        [me.id],
      )
    )[0].n,
  }));
  const upcoming = events.filter((e) => isActive(e.event_date));
  const past = events.filter((e) => !isActive(e.event_date)).reverse();
  const status = (i: Idea) => ideaStatus(i.id, i.event_id, contributions, me.id);
  const isTaken = (i: Idea) => status(i).total >= 100 && status(i).mine === 0;

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold tracking-tight">
          {sp.bienvenue ? `Bienvenue ${me.display_name} 🎉` : `Bonjour ${me.display_name} 👋`}
        </h1>
        <div className="flex gap-2">
          <Link href={`/listes/${me.id}`} className="btn-secondary py-2 text-xs">
            📝 {children.length ? "Nos listes" : "Ma liste"}
            {reserve > 0 && <span className="rounded-full bg-amber-100 px-1.5 text-amber-800">📦 {reserve}</span>}
          </Link>
          <Link href="/mes-cadeaux" className="btn-secondary py-2 text-xs">
            🎁 Mes cadeaux
            {chosen > 0 && <span className="rounded-full bg-emerald-100 px-1.5 text-emerald-800">{chosen}</span>}
          </Link>
        </div>
      </div>

      {upcoming.length === 0 && (
        <Empty icon="📅">
          Aucun événement à venir.
          {!me.is_child && (
            <div className="mt-3">
              <Link href="/evenements/nouveau" className="btn-primary">Créer un événement</Link>
            </div>
          )}
        </Empty>
      )}

      {upcoming.map((e) => {
        const eventIdeas = ideas.filter((i) => i.event_id === e.id);
        // Les personnes de l'événement (sauf moi) dont je vois la liste
        const people = (e.event_beneficiaries ?? [])
          .map((b) => member(b.member_id))
          .filter((m): m is NonNullable<typeof m> => !!m && m.id !== me.id && viewable.has(m.id))
          .sort((a, b) => a.display_name.localeCompare(b.display_name));
        const taken = sortForGiver(eventIdeas.filter(isTaken), contributions, me.id);
        const back = (pid: string) => `/#e${e.id.slice(0, 8)}-${pid.slice(0, 8)}`;

        return (
          <section key={e.id} className="mb-10">
            <div className="band sticky top-14 z-20 -mx-4 mb-5 flex items-center justify-between gap-3 px-4 py-3 shadow-sm sm:mx-0 sm:rounded-2xl">
              <h2 className="min-w-0 truncate text-lg font-extrabold">
                🎁 {e.name} <span className="text-sm font-bold text-accent">· {formatCountdown(e.event_date)}</span>
              </h2>
              <Link href={`/evenements/${e.id}`} className="shrink-0 rounded-lg px-2 py-1 text-xs font-bold text-band-ink/85 hover:bg-white/10">
                Détails ›
              </Link>
            </div>

            {people.length === 0 && (
              <p className="text-sm text-muted">Aucune liste à consulter pour cet événement.</p>
            )}

            {people.map((p) => {
              const list = sortForGiver(
                eventIdeas.filter((i) => i.beneficiary_id === p.id && !isTaken(i)),
                contributions,
                me.id,
              );
              const hasList = eventIdeas.some((i) => i.beneficiary_id === p.id);
              const suggestHref = `/idees/nouvelle?pour=${p.id}&evenement=${e.id}&back=${encodeURIComponent(back(p.id))}`;
              return (
                <div key={p.id} id={back(p.id).slice(2)} className="mb-6 scroll-mt-28">
                  <div className="mb-3 flex items-center gap-2 rounded-xl bg-brand-50 px-2 py-1.5">
                    <Avatar member={p} size="sm" />
                    <h3 className="flex-1 font-extrabold text-brand-700">Pour {p.display_name}</h3>
                    <Link href={suggestHref} className="rounded-lg px-2 py-1 text-xs font-bold text-brand-700 hover:bg-brand-100">
                      {isParentOf(p.id) ? "+ Ajouter" : "+ Suggérer"}
                    </Link>
                  </div>
                  {list.length > 0 ? (
                    <div className="space-y-3">
                      {list.map((idea) => (
                        <IdeaCard
                          key={idea.id}
                          idea={idea}
                          mode="giver"
                          status={status(idea)}
                          open
                          canEdit={idea.is_secret && idea.created_by === me.id && !isParentOf(p.id)}
                          back={back(p.id)}
                          member={member}
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="rounded-xl border border-dashed border-line px-4 py-3 text-sm text-muted">
                      {hasList ? "🎉 Tout est déjà choisi." : "Pas encore d'idée."}
                    </p>
                  )}
                </div>
              );
            })}

            {taken.length > 0 && (
              <details>
                <summary className="cursor-pointer text-sm font-bold text-muted hover:text-ink">
                  Déjà choisies par d&apos;autres ({taken.length}) ▾
                </summary>
                <ul className="mt-2 space-y-1 text-sm text-muted">
                  {taken.map((i) => (
                    <li key={i.id} className="flex items-center gap-2">
                      <Avatar member={member(i.beneficiary_id)} size="sm" />
                      <span className="line-through">{i.title}</span>
                      <span className="text-xs">
                        ({status(i).others.map((c) => member(c.member_id)?.display_name).join(", ")})
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </section>
        );
      })}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5 text-sm">
        {!me.is_child && (
          <Link href="/evenements/nouveau" className="font-bold text-brand-600 hover:underline">+ Nouvel événement</Link>
        )}
        {past.length > 0 && (
          <details>
            <summary className="cursor-pointer font-bold text-muted hover:text-ink">Événements passés ({past.length}) ▾</summary>
            <ul className="mt-2">
              {past.map((e) => (
                <li key={e.id}>
                  <Link href={`/evenements/${e.id}`} className="flex justify-between gap-4 rounded-xl px-3 py-1.5 hover:bg-white">
                    <span className="font-bold">{e.name}</span>
                    <span className="text-muted">{formatDate(e.event_date)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </>
  );
}
