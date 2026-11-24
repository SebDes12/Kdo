import "server-only";
import type { Session } from "@/lib/session";
import { EVENTS_SQL, memberInEvent } from "@/lib/ideas";
import type { EventRow } from "@/lib/types";

/** Événements à venir des groupes dont `memberId` fait partie. */
export async function upcomingEventsFor(session: Session, memberId: string): Promise<EventRow[]> {
  return session.q<EventRow>(
    `${EVENTS_SQL}
     where e.event_date >= current_date and ${memberInEvent("$1")}
     order by e.event_date`,
    [memberId],
  );
}
