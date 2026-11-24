import "server-only";
import type { Session } from "@/lib/session";
import type { Group, GroupMember } from "@/lib/types";

export async function loadGroups(session: Session) {
  return session.tx(async (q) => ({
    groups: await q<Group>("select id, name, created_by from groups order by name"),
    groupMembers: await q<GroupMember>("select group_id, member_id from group_members"),
  }));
}
