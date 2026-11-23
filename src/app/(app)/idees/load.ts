import "server-only";
import type { Session } from "@/lib/session";
import { isActive } from "@/lib/format";
import type { EventRow } from "@/lib/types";

/** Événements à venir dont `memberId` est bénéficiaire. */
export async function upcomingEventsFor(session: Session, memberId: string): Promise<EventRow[]> {
  const { data } = await session.supabase
    .from("events")
    .select("id, name, event_date, created_by, event_beneficiaries!inner(member_id)")
    .eq("event_beneficiaries.member_id", memberId)
    .order("event_date");
  return ((data ?? []) as EventRow[]).filter((e) => isActive(e.event_date));
}
