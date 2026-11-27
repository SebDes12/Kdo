import type { Contribution, Idea } from "@/lib/types";

/** Idées avec leurs liens (à compléter par un WHERE sur l'alias i). */
export const IDEAS_SQL = `
  select i.id, i.beneficiary_id, i.event_id, i.title, i.description, i.price_cents, i.priority,
         i.image_url, i.is_secret, i.created_by, i.created_at, i.deleted_at, i.deleted_by,
         -- Version de la photo envoyée (jamais ses octets : servis par /idees/[id]/image)
         (select floor(extract(epoch from im.updated_at) * 1000)::bigint::text
          from idea_images im where im.idea_id = i.id) as image_version,
         coalesce((select json_agg(json_build_object('id', l.id, 'url', l.url, 'position', l.position)
                                   order by l.position)
                   from idea_links l where l.idea_id = i.id), '[]') as idea_links
  from ideas i`;

/** Événements avec leurs groupes (à compléter par un WHERE sur l'alias e). */
export const EVENTS_SQL = `
  select e.id, e.name, e.event_date, e.end_date, e.created_by, e.updated_at, e.updated_by, e.deleted_at, e.deleted_by,
         coalesce((select json_agg(json_build_object('group_id', eg.group_id))
                   from event_groups eg where eg.event_id = e.id), '[]') as event_groups
  from events e`;

/** Condition SQL : le membre $n fait partie d'un groupe de l'événement e. */
export const memberInEvent = (param: string) => `exists (
  select 1 from event_groups eg join group_members gm on gm.group_id = eg.group_id
  where eg.event_id = e.id and gm.member_id = ${param})`;

/** Nombre d'idées « en réserve » (sans événement ou d'un événement passé) par bénéficiaire. */
export const RESERVE_COUNTS_SQL = `
  select i.beneficiary_id, count(*)::int as n
  from ideas i left join events e on e.id = i.event_id
  where i.beneficiary_id = any($1::uuid[]) and i.deleted_at is null
    and (i.event_id is null or e.end_date < current_date or e.deleted_at is not null)
  group by i.beneficiary_id`;

export const CONTRIBUTIONS_SQL = "select idea_id, event_id, member_id, percent from contributions";

export type IdeaStatus = {
  total: number;
  mine: number;
  others: Contribution[];
  remaining: number;
};

export function ideaStatus(ideaId: string, eventId: string | null, contributions: Contribution[], meId: string): IdeaStatus {
  const rows = contributions.filter((c) => c.idea_id === ideaId && c.event_id === eventId);
  const total = rows.reduce((s, c) => s + c.percent, 0);
  const mine = rows.find((c) => c.member_id === meId)?.percent ?? 0;
  return { total, mine, others: rows.filter((c) => c.member_id !== meId), remaining: 100 - total };
}

/** Tri pour la personne qui offre : disponibles d'abord, puis priorité. */
export function sortForGiver(ideas: Idea[], contributions: Contribution[], meId: string): Idea[] {
  return [...ideas].sort((a, b) => {
    const sa = ideaStatus(a.id, a.event_id, contributions, meId);
    const sb = ideaStatus(b.id, b.event_id, contributions, meId);
    const rank = (s: IdeaStatus) => (s.total >= 100 && !s.mine ? 2 : s.total >= 100 ? 1 : 0);
    return rank(sa) - rank(sb) || b.priority - a.priority || a.created_at.localeCompare(b.created_at);
  });
}

export function sortForOwner(ideas: Idea[]): Idea[] {
  return [...ideas].sort((a, b) => b.priority - a.priority || a.created_at.localeCompare(b.created_at));
}

export const PRIORITIES = [
  { value: 0, label: "Normale" },
  { value: 1, label: "★ J'aimerais bien" },
  { value: 2, label: "★★ J'adorerais" },
  { value: 3, label: "★★★ Coup de cœur" },
];

/** Adresse de l'image d'une idée : photo envoyée (vignette ou grande) ou adresse web. */
export function ideaImageSrc(idea: Pick<Idea, "id" | "image_url" | "image_version">, size: "vignette" | "grande"): string | null {
  if (idea.image_version) return `/idees/${idea.id}/image?taille=${size}&v=${idea.image_version}`;
  return idea.image_url;
}
