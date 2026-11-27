import Link from "next/link";
import { IdeaCard } from "@/components/idea-card";
import { NoelNudge } from "@/components/theme";
import { Avatar, Empty } from "@/components/ui";
import { eventCountdown, formatPeriod, isOpen } from "@/lib/format";
import {
  CONTRIBUTIONS_SQL,
  EVENTS_SQL,
  IDEAS_SQL,
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
  const { tx, me, member, isParentOf } = await getSession();

  const { events, ideas, contributions, myEvents, myCounts, warnings } = await tx(async (q) => ({
    // Effacement des idées supprimées dont l'événement est fini depuis plus de 2 jours
    purged: await q("select purge_deleted_ideas(), purge_deleted_events()"),
    // Cadeaux que j'ai choisis puis que la personne a retirés de sa liste ou de l'événement
    warnings: (
      await q<{ n: number }>(
        `select count(*)::int as n from contributions c
         join ideas i on i.id = c.idea_id join events e on e.id = c.event_id
         where c.member_id = $1 and e.end_date >= current_date
           and (i.deleted_at is not null or i.event_id is distinct from c.event_id or e.deleted_at is not null)`,
        [me.id],
      )
    )[0].n,
    // Événements à venir dont je fais partie, et le nombre d'idées que j'y ai mises
    myEvents: new Set(
      (
        await q<{ event_id: string }>(
          `select distinct eg.event_id from event_groups eg join group_members gm on gm.group_id = eg.group_id
           where gm.member_id = $1`,
          [me.id],
        )
      ).map((r) => r.event_id),
    ),
    myCounts: new Map(
      (
        await q<{ event_id: string; n: number }>(
          "select event_id, count(*)::int as n from ideas where beneficiary_id = $1 and event_id is not null group by event_id",
          [me.id],
        )
      ).map((r) => [r.event_id, r.n]),
    ),
    events: await q<EventRow>(`${EVENTS_SQL} where e.deleted_at is null order by e.event_date`),
    // Idées des autres sur les événements à venir (la base ne renvoie que celles des événements de mes groupes)
    ideas: await q<Idea>(
      `${IDEAS_SQL}
       where i.beneficiary_id <> $1 and i.deleted_at is null
         and i.event_id in (select id from events where end_date >= current_date and deleted_at is null)`,
      [me.id],
    ),
    contributions: await q<Contribution>(
      `${CONTRIBUTIONS_SQL} where event_id in (select id from events where end_date >= current_date and deleted_at is null)`,
    ),
  }));
  const upcoming = events.filter((e) => isOpen(e));
  const past = events.filter((e) => !isOpen(e)).reverse();
  const status = (i: Idea) => ideaStatus(i.id, i.event_id, contributions, me.id);
  const isTaken = (i: Idea) => status(i).total >= 100 && status(i).mine === 0;

  return (
    <>
      <div className="mb-5">
        <h1 className="text-2xl font-extrabold tracking-tight">
          {sp.bienvenue ? `Bienvenue ${me.display_name} 🎉` : `Bonjour ${me.display_name} 👋`}
        </h1>
      </div>

      <NoelNudge />

      {warnings > 0 && (
        <Link
          href="/j-offre"
          className="mb-5 flex items-center justify-between gap-3 rounded-xl border-2 border-amber-300 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900 hover:bg-amber-100"
        >
          <span>
            ⚠️ {warnings} cadeau{warnings > 1 ? "x" : ""} que tu as choisi{warnings > 1 ? "s" : ""} {warnings > 1 ? "ont" : "a"} été
            retiré{warnings > 1 ? "s" : ""} d&apos;une liste
          </span>
          <span>Voir ›</span>
        </Link>
      )}

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

      {upcoming.length >= 2 && (
        <nav className="-mx-4 mb-6 flex gap-2 overflow-x-auto px-4 pb-1" aria-label="Événements">
          {upcoming.map((e, n) => (
            <a
              key={e.id}
              href={`#evt-${e.id}`}
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold shadow-sm ${ZONES[n % ZONES.length].chip}`}
            >
              🎁 {e.name} <span className="font-semibold opacity-80">· {eventCountdown(e)}</span>
            </a>
          ))}
        </nav>
      )}

      {upcoming.map((e, n) => {
        const zone = ZONES[n % ZONES.length];
        const eventIdeas = ideas.filter((i) => i.event_id === e.id);
        // Les personnes (sauf moi) qui ont mis une liste sur cet événement
        const people = [...new Set(eventIdeas.map((i) => i.beneficiary_id))]
          .map((pid) => member(pid))
          .filter((m): m is NonNullable<typeof m> => !!m && m.id !== me.id)
          .sort((a, b) => a.display_name.localeCompare(b.display_name));
        const mine = myCounts.get(e.id) ?? 0;
        const myListHref = `/idees/nouvelle?pour=${me.id}&evenement=${e.id}&back=${encodeURIComponent("/")}`;
        const taken = sortForGiver(eventIdeas.filter(isTaken), contributions, me.id);
        const back = (pid: string) => `/#e${e.id.slice(0, 8)}-${pid.slice(0, 8)}`;

        return (
          <section key={e.id} id={`evt-${e.id}`} className={`-mx-4 mb-12 scroll-mt-20 border-y-2 sm:mx-0 sm:border-2 ${zone.zone}`}>
            <div className={`flex items-center justify-between gap-3 border-b-[3px] border-accent px-4 py-3 ${zone.band}`}>
              <h2 className="min-w-0 truncate text-lg font-extrabold">
                🎁 {e.name} <span className={`text-sm font-bold ${zone.accent}`}>· {eventCountdown(e)}</span>
              </h2>
              <Link href={`/evenements/${e.id}`} className="shrink-0 rounded-lg px-2 py-1 text-xs font-bold opacity-85 hover:bg-white/10">
                Détails ›
              </Link>
            </div>
            <div className="p-3 sm:p-4">

            {myEvents.has(e.id) && (
              <div className="mb-4 flex items-stretch overflow-hidden rounded-xl border-2 border-dashed border-line bg-white/70 text-sm">
                <Link
                  href={`/evenements/${e.id}?pour=${me.id}`}
                  className="flex flex-1 items-center gap-1 px-3 py-2 hover:bg-brand-50"
                >
                  📝 Ta liste ici : <strong>{mine} idée{mine > 1 ? "s" : ""}</strong>
                  <span className="ml-1 text-muted">›</span>
                </Link>
                <Link
                  href={myListHref}
                  className="flex items-center border-l-2 border-dashed border-line px-3 py-2 font-bold text-brand-600 hover:bg-brand-50"
                >
                  + Ajouter
                </Link>
              </div>
            )}

            {people.length === 0 && (
              <p className="px-2 pb-2 text-sm text-muted">Personne n&apos;a encore ajouté de liste à cet événement.</p>
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
                <div
                  key={p.id}
                  id={back(p.id).slice(2)}
                  className="mb-4 scroll-mt-20 overflow-hidden rounded-2xl border-2 border-line bg-white shadow-md"
                >
                  <div className="flex items-center gap-2 border-b-2 border-accent bg-brand-50 px-3 py-2.5">
                    <Avatar member={p} />
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-lg font-extrabold text-brand-700">Pour {p.display_name}</h3>
                      <p className="text-xs font-semibold text-muted">
                        {list.length} idée{list.length > 1 ? "s" : ""} à choisir
                      </p>
                    </div>
                    <Link href={suggestHref} className="shrink-0 rounded-lg px-2 py-1 text-xs font-bold text-brand-700 hover:bg-brand-100">
                      {isParentOf(p.id) ? "+ Ajouter" : "+ Suggérer"}
                    </Link>
                  </div>
                  {list.length > 0 ? (
                    <div className="divide-y-2 divide-line">
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
                          variant="row"
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="px-4 py-4 text-sm text-muted">
                      {hasList ? "🎉 Tout est déjà choisi." : "Pas encore d'idée."}
                    </p>
                  )}
                </div>
              );
            })}

            {taken.length > 0 && (
              <details className="px-2 pb-1">
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
            </div>
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
                    <span className="text-muted">{formatPeriod(e)}</span>
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

/** Teintes alternées des zones d'événement sur l'accueil. */
const ZONES = [
  { zone: "bg-band/[0.05] border-band", band: "band", accent: "text-accent", chip: "band" },
  { zone: "bg-zone2/[0.07] border-zone2", band: "bg-zone2 text-white", accent: "text-white/80", chip: "bg-zone2 text-white" },
  { zone: "bg-zone3/[0.07] border-zone3", band: "bg-zone3 text-white", accent: "text-white/80", chip: "bg-zone3 text-white" },
];
