import { SubmitButton } from "@/components/client";
import { Avatar } from "@/components/ui";
import type { Member } from "@/lib/types";

export function EventForm({
  action,
  members,
  initial,
  submitLabel,
}: {
  action: (fd: FormData) => Promise<void>;
  members: Member[];
  initial?: { name: string; date: string; beneficiaries: string[] };
  submitLabel: string;
}) {
  return (
    <form action={action} className="card space-y-5 p-5">
      <div>
        <label className="label" htmlFor="name">Nom</label>
        <input id="name" name="name" className="field" placeholder="Noël 2026, Anniversaire de Léo…" defaultValue={initial?.name} required maxLength={80} />
      </div>
      <div>
        <label className="label" htmlFor="date">Date</label>
        <input id="date" name="date" type="date" className="field" defaultValue={initial?.date} required />
      </div>
      <fieldset>
        <legend className="label">Qui reçoit des cadeaux ?</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {members.map((m) => (
            <label key={m.id} className="flex cursor-pointer items-center gap-3 rounded-xl border border-line bg-white px-3 py-2 has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50">
              <input type="checkbox" name="beneficiaries" value={m.id} defaultChecked={initial?.beneficiaries.includes(m.id)} className="size-4 accent-brand-600" />
              <Avatar member={m} size="sm" />
              <span className="font-bold">{m.display_name}</span>
              {m.is_child && <span className="text-xs text-muted">enfant</span>}
            </label>
          ))}
        </div>
        <p className="hint">Pour Noël, coche tout le monde ; pour un anniversaire, une seule personne.</p>
      </fieldset>
      <SubmitButton className="btn-primary w-full sm:w-auto">{submitLabel}</SubmitButton>
    </form>
  );
}
