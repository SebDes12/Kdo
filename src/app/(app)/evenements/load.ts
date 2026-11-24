import "server-only";
import type { Session } from "@/lib/session";
import type { Group } from "@/lib/types";

/** Groupes dont je suis membre, avec leur nombre de membres. */
export async function myGroups(session: Session) {
  return session.q<Group & { count: number; can_create: boolean }>(
    `select g.id, g.name, g.created_by,
            (select count(*)::int from group_members x where x.group_id = g.id) as count,
            (g.event_creation = 'members' or is_group_admin(g.id)) as can_create
     from groups g
     where exists (select 1 from group_members gm where gm.group_id = g.id and gm.member_id = $1)
     order by g.name`,
    [session.me.id],
  );
}
