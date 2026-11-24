import Link from "next/link";
import { SubmitButton } from "@/components/client";
import type { Group } from "@/lib/types";

export function EventForm({
  action,
  groups,
  initial,
  submitLabel,
}: {
  action: (fd: FormData) => Promise<void>;
  /** Groupes dont je suis membre. */
  groups: (Group & { count: number })[];
  initial?: { name: string; date: string; end: string; groups: string[] };
  submitLabel: string;
}) {
  return (
    <form action={action} className="card space-y-5 p-5">
      <div>
        <label className="label" htmlFor="name">Nom</label>
        <input id="name" name="name" className="field" placeholder="Noël 2026, Anniversaire de Léo…" defaultValue={initial?.name} required maxLength={80} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="date">Date (début)</label>
          <input id="date" name="date" type="date" className="field" defaultValue={initial?.date} required />
        </div>
        <div>
          <label className="label" htmlFor="end">Jusqu&apos;au (facultatif)</label>
          <input
            id="end"
            name="end"
            type="date"
            className="field"
            defaultValue={initial && initial.end !== initial.date ? initial.end : ""}
          />
          <p className="hint">Si on fête en plusieurs fois. On peut choisir des cadeaux jusqu&apos;à cette date.</p>
        </div>
      </div>
      <fieldset>
        <legend className="label">Pour quel(s) groupe(s) ?</legend>
        {groups.length === 0 ? (
          <p className="text-sm text-muted">
            Tu ne fais partie d&apos;aucun groupe.{" "}
            <Link href="/famille#groupes" className="font-bold text-brand-600">Crée d&apos;abord un groupe</Link>.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {groups.map((g) => (
              <label
                key={g.id}
                className="flex cursor-pointer items-center gap-2 rounded-full border-2 border-line bg-white px-3 py-1.5 text-sm font-bold has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50 has-[:checked]:text-brand-700"
              >
                <input
                  type="checkbox"
                  name="groups"
                  value={g.id}
                  defaultChecked={initial ? initial.groups.includes(g.id) : groups.length === 1}
                  className="size-4 accent-brand-600"
                />
                👥 {g.name} <span className="font-semibold text-muted">· {g.count}</span>
              </label>
            ))}
          </div>
        )}
        <p className="hint">
          Tous les membres de ces groupes voient l&apos;événement. Chacun peut y ajouter sa liste d&apos;idées (pour un
          anniversaire, seule la personne fêtée le fera).
        </p>
      </fieldset>
      <SubmitButton className="btn-primary w-full sm:w-auto">{submitLabel}</SubmitButton>
    </form>
  );
}
