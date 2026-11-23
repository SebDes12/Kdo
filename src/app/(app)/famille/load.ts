import "server-only";
import type { Session } from "@/lib/session";
import type { Group, GroupMember, ListShare } from "@/lib/types";

export async function loadSharing(session: Session) {
  const [{ data: g }, { data: gm }, { data: s }] = await Promise.all([
    session.supabase.from("groups").select("id, name, created_by").order("name"),
    session.supabase.from("group_members").select("group_id, member_id"),
    session.supabase.from("list_shares").select("id, owner_id, group_id, member_id"),
  ]);
  return {
    groups: (g ?? []) as Group[],
    groupMembers: (gm ?? []) as GroupMember[],
    shares: (s ?? []) as ListShare[],
  };
}
