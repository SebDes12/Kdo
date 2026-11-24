import { toggleGroupMember } from "@/app/actions/family";
import { SubmitButton } from "@/components/client";
import type { Group, GroupMember, Member } from "@/lib/types";

/** Interrupteurs « membre de ce groupe ? » pour un membre (son enfant). */
export function GroupToggles({
  member,
  groups,
  groupMembers,
  back,
}: {
  member: Member;
  groups: Group[];
  groupMembers: GroupMember[];
  back: string;
}) {
  if (!groups.length) {
    return <p className="text-sm text-muted">Tu ne fais partie d&apos;aucun groupe. Crée-en un dans « Famille ».</p>;
  }
  return (
    <ul className="card divide-y divide-line">
      {groups.map((g) => {
        const on = groupMembers.some((gm) => gm.group_id === g.id && gm.member_id === member.id);
        const count = groupMembers.filter((gm) => gm.group_id === g.id).length;
        return (
          <li key={g.id}>
            <form action={toggleGroupMember} className="flex items-center gap-3 px-4 py-3">
              <input type="hidden" name="group" value={g.id} />
              <input type="hidden" name="member" value={member.id} />
              <input type="hidden" name="on" value={on ? "0" : "1"} />
              <input type="hidden" name="back" value={back} />
              <div className="min-w-0 flex-1">
                <div className="font-bold">👥 {g.name}</div>
                <div className="text-xs text-muted">{count} membre{count > 1 ? "s" : ""}</div>
              </div>
              <SubmitButton
                role="switch"
                aria-checked={on}
                aria-label={on ? `Retirer de ${g.name}` : `Ajouter à ${g.name}`}
                className={`relative h-7 w-12 shrink-0 rounded-full transition ${on ? "bg-emerald-500" : "bg-stone-300"}`}
                pendingText=""
              >
                <span className={`absolute top-1 size-5 rounded-full bg-white shadow transition-all ${on ? "left-6" : "left-1"}`} />
              </SubmitButton>
            </form>
          </li>
        );
      })}
    </ul>
  );
}
