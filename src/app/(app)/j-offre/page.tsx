import Link from "next/link";
import type { Metadata } from "next";
import { withdraw } from "@/app/actions/ideas";
import { ConfirmButton } from "@/components/client";
import { Avatar, Badge, Empty, PageHeader, Section } from "@/components/ui";
import { eventCountdown, formatPeriod, formatPrice, hostname, isOpen } from "@/lib/format";
import { IDEAS_SQL } from "@/lib/ideas";
import { getSession } from "@/lib/session";

export const metadata: Metadata = { title: "J'offre" };

type Row = {
  percent: number;
  idea: {
    id: string;
    title: string;
    beneficiary_id: string;
    price_cents: number | null;
    event_id: string | null;
    deleted_at: string | null;
    idea_links: { url: string; position: number }[];
  } | null;
  event: { id: string; name: string; event_date: string; end_date: string } | null;
};

export default async function MyGiftsPage() {
  const { q, me, member } = await getSession();
  const rows = await q<Row>(
    `select c.percent,
            json_build_object('id', i.id, 'title', i.title, 'beneficiary_id', i.beneficiary_id,
              'price_cents', i.price_cents, 'event_id', i.event_id, 'deleted_at', i.deleted_at,
              'idea_links', i.idea_links) as idea,
            json_build_object('id', e.id, 'name', e.name, 'event_date', e.event_date, 'end_date', e.end_date) as event
     from contributions c
     join (${IDEAS_SQL}) i on i.id = c.idea_id
     join events e on e.id = c.event_id
     where c.member_id = $1`,
    [me.id],
  );

  const byEvent = new Map<string, { event: NonNullable<Row["event"]>; rows: Row[] }>();
  for (const r of rows) {
    const g = byEvent.get(r.event!.id) ?? { event: r.event!, rows: [] };
    g.rows.push(r);
    byEvent.set(r.event!.id, g);
  }
  const groups = [...byEvent.values()].sort((a, b) => a.event.event_date.localeCompare(b.event.event_date));
  const upcoming = groups.filter((g) => isOpen(g.event));
  const past = groups.filter((g) => !isOpen(g.event)).reverse();

  const renderGroup = (g: (typeof groups)[number]) => {
    const budget = g.rows.reduce((s, r) => s + (r.idea!.price_cents ?? 0) * (r.percent / 100), 0);
    return (
      <Section
        key={g.event.id}
        title={<Link href={`/evenements/${g.event.id}`} className="hover:text-brand-600">{g.event.name}</Link>}
        description={`${formatPeriod(g.event)} · ${eventCountdown(g.event)}${budget ? ` · budget ≈ ${formatPrice(Math.round(budget))}` : ""}`}
      >
        <ul className="card divide-y divide-line">
          {g.rows.map((r) => {
            const who = member(r.idea!.beneficiary_id);
            const link = [...r.idea!.idea_links].sort((a, b) => a.position - b.position)[0];
            // L'idée a été supprimée, ou retirée de l'événement pour lequel je l'avais choisie
            const warning = r.idea!.deleted_at
              ? `${who?.display_name ?? "La personne"} l'a retirée de sa liste.`
              : r.idea!.event_id !== g.event.id
                ? `${who?.display_name ?? "La personne"} l'a retirée de « ${g.event.name} ».`
                : null;
            return (
              <li key={r.idea!.id} className={`flex flex-wrap items-center gap-3 p-3 ${warning ? "bg-amber-50" : ""}`}>
                <Avatar member={who} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{r.idea!.title}</p>
                  <p className="text-xs text-muted">
                    pour {who?.display_name}
                    {link && (
                      <>
                        {" · "}
                        <a href={link.url} target="_blank" rel="noopener noreferrer nofollow" className="font-bold text-brand-600">
                          {hostname(link.url)} ↗
                        </a>
                      </>
                    )}
                  </p>
                </div>
                <Badge tone={r.percent === 100 ? "green" : "amber"}>{r.percent} %</Badge>
                {warning && (
                  <div className="flex w-full flex-wrap items-center gap-2 text-sm font-semibold text-amber-900">
                    <span className="flex-1">⚠️ {warning} Ton choix est conservé : garde-le ou annule-le.</span>
                    {isOpen(g.event) && (
                      <form action={withdraw}>
                        <input type="hidden" name="idea" value={r.idea!.id} />
                        <input type="hidden" name="event" value={g.event.id} />
                        <input type="hidden" name="back" value="/j-offre" />
                        <ConfirmButton message="Annuler ton choix ?" className="btn-secondary py-1 text-xs">
                          Annuler mon choix
                        </ConfirmButton>
                      </form>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </Section>
    );
  };

  return (
    <>
      <PageHeader title="Ce que j'offre" subtitle="Les cadeaux que tu as choisis pour les autres, pour ne rien oublier." />
      {upcoming.length === 0 ? (
        <Empty>
          Tu n&apos;as encore rien choisi.
          <div className="mt-3"><Link href="/" className="btn-primary">Voir les événements</Link></div>
        </Empty>
      ) : (
        upcoming.map(renderGroup)
      )}
      {past.length > 0 && (
        <details className="mb-10">
          <summary className="mb-4 cursor-pointer text-sm font-bold text-muted hover:text-ink">Cadeaux passés ▾</summary>
          {past.map(renderGroup)}
        </details>
      )}
    </>
  );
}
