import Link from "next/link";
import { Avatar, Empty, PageHeader, Section } from "@/components/ui";
import { formatCountdown, formatDate, isActive } from "@/lib/format";
import { CONTRIBUTIONS_SQL, EVENTS_SQL, ideaStatus } from "@/lib/ideas";
import { getSession } from "@/lib/session";
import type { Contribution, EventRow } from "@/lib/types";

export default async function HomePage({ searchParams }: PageProps<"/">) {
  const sp = await searchParams;
  const { tx, me, member } = await getSession();

  // Événements + idées encore disponibles pour moi sur les événements à venir
  const { events, ideas, contributions } = await tx(async (q) => ({
    events: await q<EventRow>(`${EVENTS_SQL} order by e.event_date`),
    ideas: await q<{ id: string; event_id: string }>(
      `select i.id, i.event_id from ideas i join events e on e.id = i.event_id
       where e.event_date >= current_date and i.beneficiary_id <> $1`,
      [me.id],
    ),
    contributions: await q<Contribution>(
      `${CONTRIBUTIONS_SQL} where event_id in (select id from events where event_date >= current_date)`,
    ),
  }));
  const upcoming = events.filter((e) => isActive(e.event_date));
  const past = events.filter((e) => !isActive(e.event_date)).reverse();
  const stats = (eventId: string) => {
    const list = ideas.filter((i) => i.event_id === eventId);
    const st = list.map((i) => ideaStatus(i.id, eventId, contributions, me.id));
    return { free: st.filter((s) => s.total < 100).length, mine: st.filter((s) => s.mine > 0).length };
  };

  return (
    <>
      <PageHeader
        title={sp.bienvenue ? `Bienvenue ${me.display_name} 🎉` : `Bonjour ${me.display_name} 👋`}
        subtitle="Choisis un événement pour voir les listes et réserver un cadeau."
      />

      <div className="mb-8 grid grid-cols-2 gap-3">
        <Link href={`/listes/${me.id}`} className="card flex flex-col gap-1 p-4 transition hover:border-brand-200 hover:shadow-md">
          <span className="text-2xl">📝</span>
          <span className="font-extrabold">Ma liste</span>
          <span className="text-xs text-muted">Ajouter mes idées</span>
        </Link>
        {me.is_child ? (
          <Link href="/mes-cadeaux" className="card flex flex-col gap-1 p-4 transition hover:border-brand-200 hover:shadow-md">
            <span className="text-2xl">🎁</span>
            <span className="font-extrabold">Mes cadeaux</span>
            <span className="text-xs text-muted">Ce que j&apos;offre</span>
          </Link>
        ) : (
          <Link href="/evenements/nouveau" className="card flex flex-col gap-1 p-4 transition hover:border-brand-200 hover:shadow-md">
            <span className="text-2xl">📅</span>
            <span className="font-extrabold">Nouvel événement</span>
            <span className="text-xs text-muted">Noël, anniversaire…</span>
          </Link>
        )}
      </div>

      <Section title="Événements à venir">
        {upcoming.length === 0 ? (
          <Empty icon="📅">
            Aucun événement pour l&apos;instant.
            {!me.is_child && (
              <div className="mt-3">
                <Link href="/evenements/nouveau" className="btn-primary">Créer un événement</Link>
              </div>
            )}
          </Empty>
        ) : (
          <ul className="space-y-3">
            {upcoming.map((e) => {
              const s = stats(e.id);
              const people = (e.event_beneficiaries ?? []).map((b) => member(b.member_id)).filter(Boolean);
              const others = people.filter((p) => p!.id !== me.id);
              return (
                <li key={e.id}>
                  <Link href={`/evenements/${e.id}`} className="card flex items-center gap-4 p-4 transition hover:border-brand-200 hover:shadow-md">
                    <div className="flex size-14 shrink-0 flex-col items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                      <span className="text-lg font-extrabold leading-none">{e.event_date.slice(8, 10)}</span>
                      <span className="text-[10px] font-bold uppercase">
                        {new Intl.DateTimeFormat("fr-FR", { month: "short", timeZone: "UTC" }).format(new Date(e.event_date))}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="truncate font-extrabold">{e.name}</h3>
                        <span className="shrink-0 text-xs font-bold text-brand-600">{formatCountdown(e.event_date)}</span>
                      </div>
                      <div className="mt-1.5 flex items-center gap-2">
                        <div className="flex -space-x-2">
                          {people.slice(0, 6).map((p) => <Avatar key={p!.id} member={p} size="sm" />)}
                        </div>
                        {others.length > 0 && (
                          <span className="truncate text-xs font-semibold text-muted">
                            {s.free} idée{s.free > 1 ? "s" : ""} dispo
                            {s.mine > 0 && ` · ${s.mine} choisie${s.mine > 1 ? "s" : ""} par toi`}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-muted">›</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      {past.length > 0 && (
        <details className="mb-10">
          <summary className="cursor-pointer text-sm font-bold text-muted hover:text-ink">
            Événements passés ({past.length}) ▾
          </summary>
          <ul className="mt-3 space-y-2">
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
