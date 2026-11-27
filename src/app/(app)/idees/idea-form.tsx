import Link from "next/link";
import { saveIdea } from "@/app/actions/ideas";
import { LinksEditor, PhotoPicker, SubmitButton } from "@/components/client";
import { Notice } from "@/components/ui";
import { ideaImageSrc, PRIORITIES } from "@/lib/ideas";
import type { EventRow, Idea, Member } from "@/lib/types";

export function IdeaForm({
  beneficiary,
  me,
  isParent,
  events,
  idea,
  defaultEvent,
  back,
  formPath,
}: {
  beneficiary: Member;
  me: Member;
  isParent: boolean;
  events: EventRow[];
  idea?: Idea;
  defaultEvent?: string;
  back: string;
  formPath: string;
}) {
  const isMe = beneficiary.id === me.id;
  const forcedSecret = !isMe && !isParent;
  const price = idea?.price_cents != null ? String(idea.price_cents / 100).replace(".", ",") : "";
  const links = idea ? [...idea.idea_links].sort((a, b) => a.position - b.position).map((l) => l.url) : [];
  const currentEvent = idea ? idea.event_id ?? "" : defaultEvent ?? "";
  const keepsPastEvent = !!currentEvent && !events.some((e) => e.id === currentEvent);

  return (
    <form action={saveIdea} className="card space-y-5 p-5">
      <input type="hidden" name="id" value={idea?.id ?? ""} />
      <input type="hidden" name="beneficiary" value={beneficiary.id} />
      <input type="hidden" name="back" value={back} />
      <input type="hidden" name="form" value={formPath} />

      {forcedSecret && (
        <Notice tone="info">
          🤫 Cette idée restera <strong>invisible pour {beneficiary.display_name}</strong>. Les autres personnes qui voient sa liste la verront.
        </Notice>
      )}

      <div>
        <label className="label" htmlFor="title">Titre *</label>
        <input id="title" name="title" className="field" required maxLength={200} defaultValue={idea?.title} placeholder="Ex. : Lego Technic 42151" autoFocus={!idea} />
      </div>

      <div>
        <span className="label">Liens d&apos;achat</span>
        <LinksEditor initial={links} />
      </div>

      <div>
        <label className="label" htmlFor="description">Description</label>
        <textarea id="description" name="description" rows={3} className="field" maxLength={4000} defaultValue={idea?.description ?? ""} placeholder="Taille, couleur, précisions…" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="price">Prix indicatif (€)</label>
          <input id="price" name="price" inputMode="decimal" className="field" defaultValue={price} placeholder="Ex. : 39,90" />
        </div>
        <div>
          <label className="label" htmlFor="priority">Priorité</label>
          <select id="priority" name="priority" className="field" defaultValue={idea?.priority ?? 0}>
            {PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="label" htmlFor="event">Événement</label>
        <select id="event" name="event" className="field" defaultValue={currentEvent}>
          {keepsPastEvent && <option value={currentEvent}>Événement passé (inchangé)</option>}
          {events.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          <option value="">En réserve (sans événement)</option>
        </select>
        <p className="hint">Tu peux la retirer ou la déplacer à tout moment : si quelqu&apos;un l&apos;a déjà choisie, sa réservation est conservée.</p>
      </div>

      <div>
        <span className="label">Photo (facultatif)</span>
        <PhotoPicker photoSrc={idea?.image_version ? ideaImageSrc(idea, "vignette") : null} imageUrl={idea?.image_url ?? null} />
      </div>

      {isParent && (
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line p-3 has-[:checked]:border-violet-300 has-[:checked]:bg-violet-50">
          <input type="checkbox" name="secret" defaultChecked={idea?.is_secret} className="mt-1 size-4 accent-violet-600" />
          <span>
            <span className="font-bold">🤫 Garder secret</span>
            <span className="block text-sm text-muted">{beneficiary.display_name} ne verra pas cette idée.</span>
          </span>
        </label>
      )}

      <div className="flex gap-2">
        <SubmitButton className="btn-primary flex-1 sm:flex-none" pendingText="Enregistrement…">
          {idea ? "Enregistrer" : forcedSecret ? "Suggérer l'idée" : "Ajouter l'idée"}
        </SubmitButton>
        <Link href={back} className="btn-ghost">Annuler</Link>
      </div>
    </form>
  );
}
