import type { Contribution, Idea } from "@/lib/types";

export const IDEA_SELECT =
  "id, beneficiary_id, event_id, title, description, price_cents, priority, image_url, is_secret, created_by, created_at, idea_links(id, url, position)";

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
