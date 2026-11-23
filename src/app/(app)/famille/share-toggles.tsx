import { toggleShare } from "@/app/actions/family";
import { SubmitButton } from "@/components/client";
import { Avatar } from "@/components/ui";
import type { Group, GroupMember, ListShare, Member } from "@/lib/types";

/** Interrupteurs « qui voit la liste de owner » : groupes, et personnes si demandé. */
export function ShareToggles({
  owner,
  groups,
  groupMembers,
  shares,
  people,
  back,
}: {
  owner: Member;
  groups: Group[];
  groupMembers: GroupMember[];
  shares: ListShare[];
  people?: Member[];
  back: string;
}) {
  const mine = shares.filter((s) => s.owner_id === owner.id);
  const row = (kind: "group" | "member", target: string, label: React.ReactNode, sub?: string) => {
    const on = mine.some((s) => (kind === "group" ? s.group_id : s.member_id) === target);
    return (
      <li key={kind + target}>
        <form action={toggleShare} className="flex items-center gap-3 px-4 py-3">
          <input type="hidden" name="owner" value={owner.id} />
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="target" value={target} />
          <input type="hidden" name="on" value={on ? "0" : "1"} />
          <input type="hidden" name="back" value={back} />
          <div className="min-w-0 flex-1">
            <div className="font-bold">{label}</div>
            {sub && <div className="truncate text-xs text-muted">{sub}</div>}
          </div>
          <SubmitButton
            role="switch"
            aria-checked={on}
            aria-label={on ? "Ne plus partager" : "Partager"}
            className={`relative h-7 w-12 shrink-0 rounded-full transition ${on ? "bg-emerald-500" : "bg-stone-300"}`}
            pendingText=""
          >
            <span className={`absolute top-1 size-5 rounded-full bg-white shadow transition-all ${on ? "left-6" : "left-1"}`} />
          </SubmitButton>
        </form>
      </li>
    );
  };

  return (
    <div className="space-y-4">
      <ul className="card divide-y divide-line">
        {groups.length === 0 && <li className="px-4 py-3 text-sm text-muted">Aucun groupe. Crée-en un ci-dessous.</li>}
        {groups.map((g) => {
          const names = groupMembers.filter((gm) => gm.group_id === g.id).length;
          return row("group", g.id, <>👥 {g.name}</>, `${names} membre${names > 1 ? "s" : ""}`);
        })}
      </ul>
      {people && people.length > 0 && (
        <>
          <p className="text-sm font-bold text-muted">Ou personne par personne</p>
          <ul className="card divide-y divide-line">
            {people.map((p) =>
              row("member", p.id, <span className="flex items-center gap-2"><Avatar member={p} size="sm" /> {p.display_name}</span>),
            )}
          </ul>
        </>
      )}
    </div>
  );
}
