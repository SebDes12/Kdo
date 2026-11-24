import Link from "next/link";
import { Avatar, Empty } from "@/components/ui";
import { formatCountdown, formatDate, isActive } from "@/lib/format";
import { CONTRIBUTIONS_SQL, EVENTS_SQL, RESERVE_COUNTS_SQL, ideaStatus } from "@/lib/ideas";
import { getSession } from "@/lib/session";
import type { Contribution, EventRow } from "@/lib/types";

export default async function HomePage({ searchParams }: PageProps<"/">) {
  const sp = await searchParams;
  const { tx, me, member, children } = await getSession();

  const { events, ideas, contributions, reserve, chosen } = await tx(async (q) => ({
    events: await q<EventRow>(`${EVENTS_SQL} order by e.event_date`),
    ideas: await q<{ id: string; event_id: string }>(
      `select i.id, i.event_id from ideas i join events e on e.id = i.event_id
       where e.event_date >= current_date and i.beneficiary_id <> $1`,
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
  const freeIdeas = (eventId: string) =>
    ideas.filter((i) => i.event_id === eventId && ideaStatus(i.id, eventId, contributions, me.id).total < 100).length;

  return (
    <>
      <h1 className="mb-5 text-2xl font-extrabold tracking-tight">
        {sp.bienvenue ? `Bienvenue ${me.display_name} 🎉` : `Bonjour ${me.display_name} 👋`}
      </h1>

      <div className="mb-8 grid grid-cols-2 gap-3">
        <Tile
          href={`/listes/${me.id}`}
          icon="📝"
          title={children.length ? "Nos listes" : "Ma liste"}
          text={
            reserve > 0
              ? `📦 ${reserve} idée${reserve > 1 ? "s" : ""} en réserve`
              : children.length
                ? `Moi, ${children.map((c) => c.display_name).join(", ")}`
                : "Mes idées de cadeaux"
          }
        />
        <Tile
          href="/mes-cadeaux"
          icon="🎁"
          title="Mes cadeaux"
          text={chosen ? `${chosen} choisi${chosen > 1 ? "s" : ""}` : "Ce que j'offre"}
        />
      </div>

      <div className="mb-3 flex items-end justify-between gap-3">
        <h2 className="text-lg font-extrabold">Offrir un cadeau</h2>
        {!me.is_child && (
          <Link href="/evenements/nouveau" className="text-sm font-bold text-brand-600 hover:underline">
            + Nouvel événement
          </Link>
        )}
      </div>

      {upcoming.length === 0 ? (
        <Empty icon="📅">
          Aucun événement à venir.
          {!me.is_child && (
            <div className="mt-3">
              <Link href="/evenements/nouveau" className="btn-primary">Créer un événement</Link>
            </div>
          )}
        </Empty>
      ) : (
        <ul className="space-y-3">
          {upcoming.map((e) => {
            const people = (e.event_beneficiaries ?? []).map((b) => member(b.member_id)).filter(Boolean);
            const free = freeIdeas(e.id);
            const onlyMe = people.length === 1 && people[0]!.id === me.id;
            return (
              <li key={e.id}>
                <Link
                  href={`/evenements/${e.id}`}
                  className="card flex items-center gap-4 p-4 transition hover:border-brand-200 hover:shadow-md"
                >
                  <div className="flex size-14 shrink-0 flex-col items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                    <span className="text-lg font-extrabold leading-none">{e.event_date.slice(8, 10)}</span>
                    <span className="text-[10px] font-bold uppercase">
                      {new Intl.DateTimeFormat("fr-FR", { month: "short", timeZone: "UTC" }).format(new Date(e.event_date))}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-extrabold">{e.name}</h3>
                    <p className="text-sm text-muted">
                      {formatCountdown(e.event_date)}
                      {!onlyMe && ` · ${free} idée${free > 1 ? "s" : ""} à choisir`}
                    </p>
                  </div>
                  <div className="hidden -space-x-2 sm:flex">
                    {people.slice(0, 5).map((p) => <Avatar key={p!.id} member={p} size="sm" />)}
                  </div>
                  <span className="text-xl text-muted">›</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {past.length > 0 && (
        <details className="mt-8">
          <summary className="cursor-pointer text-sm font-bold text-muted hover:text-ink">Événements passés ({past.length}) ▾</summary>
          <ul className="mt-2">
            {past.map((e) => (
              <li key={e.id}>
                <Link href={`/evenements/${e.id}`} className="flex justify-between rounded-xl px-3 py-2 text-sm hover:bg-white">
                  <span className="font-bold">{e.name}</span>
                  <span className="text-muted">{formatDate(e.event_date)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </details>
      )}
    </>
  );
}

function Tile({ href, icon, title, text }: { href: string; icon: string; title: string; text: string }) {
  return (
    <Link href={href} className="card flex flex-col gap-0.5 p-4 transition hover:border-brand-200 hover:shadow-md">
      <span className="mb-1 text-2xl">{icon}</span>
      <span className="font-extrabold">{title}</span>
      <span className="truncate text-xs text-muted">{text}</span>
    </Link>
  );
}
