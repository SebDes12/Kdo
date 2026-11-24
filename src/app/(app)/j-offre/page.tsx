import Link from "next/link";
import type { Metadata } from "next";
import { Avatar, Badge, Empty, PageHeader, Section } from "@/components/ui";
import { formatCountdown, formatDate, formatPrice, hostname, isActive } from "@/lib/format";
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
    idea_links: { url: string; position: number }[];
  } | null;
  event: { id: string; name: string; event_date: string } | null;
};

export default async function MyGiftsPage() {
  const { q, me, member } = await getSession();
  const rows = await q<Row>(
    `select c.percent,
            json_build_object('id', i.id, 'title', i.title, 'beneficiary_id', i.beneficiary_id,
              'price_cents', i.price_cents, 'idea_links', i.idea_links) as idea,
            json_build_object('id', e.id, 'name', e.name, 'event_date', e.event_date) as event
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
  const upcoming = groups.filter((g) => isActive(g.event.event_date));
  const past = groups.filter((g) => !isActive(g.event.event_date)).reverse();

  const renderGroup = (g: (typeof groups)[number]) => {
    const budget = g.rows.reduce((s, r) => s + (r.idea!.price_cents ?? 0) * (r.percent / 100), 0);
    return (
      <Section
        key={g.event.id}
        title={<Link href={`/evenements/${g.event.id}`} className="hover:text-brand-600">{g.event.name}</Link>}
        description={`${formatDate(g.event.event_date)} · ${formatCountdown(g.event.event_date)}${budget ? ` · budget ≈ ${formatPrice(Math.round(budget))}` : ""}`}
      >
        <ul className="card divide-y divide-line">
          {g.rows.map((r) => {
            const who = member(r.idea!.beneficiary_id);
            const link = [...r.idea!.idea_links].sort((a, b) => a.position - b.position)[0];
            return (
              <li key={r.idea!.id} className="flex items-center gap-3 p-3">
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
