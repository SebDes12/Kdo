import "server-only";
import type { Session } from "@/lib/session";
import { EVENTS_SQL } from "@/lib/ideas";
import type { EventRow } from "@/lib/types";

/** Événements à venir dont `memberId` est bénéficiaire. */
export async function upcomingEventsFor(session: Session, memberId: string): Promise<EventRow[]> {
  return session.q<EventRow>(
    `${EVENTS_SQL}
     where e.event_date >= current_date
       and exists (select 1 from event_beneficiaries b where b.event_id = e.id and b.member_id = $1)
     order by e.event_date`,
    [memberId],
  );
}
