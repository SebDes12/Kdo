import Link from "next/link";
import { contribute, deleteIdea, withdraw } from "@/app/actions/ideas";
import { ConfirmButton, IdeaThumb, SubmitButton } from "@/components/client";
import { formatPrice, hostname } from "@/lib/format";
import { ideaImageSrc, type IdeaStatus } from "@/lib/ideas";
import type { Idea, Member } from "@/lib/types";

type Props = {
  idea: Idea;
  /**
   * giver  : je peux offrir (boutons « Je le prends »)
   * owner  : le bénéficiaire regarde sa liste (aucun état visible)
   * manage : un parent gère la liste de son enfant (état en lecture seule)
   */
  mode: "giver" | "owner" | "manage";
  status?: IdeaStatus;
  /** L'événement est en cours : on peut encore choisir. */
  open: boolean;
  canEdit: boolean;
  back: string;
  member: (id: string | null | undefined) => Member | undefined;
  footer?: React.ReactNode;
  /** "row" : ligne à l'intérieur d'un bloc (pas de cadre propre). */
  variant?: "card" | "row";
};

export function IdeaCard({ idea, mode, status, open, canEdit, back, member, footer, variant = "card" }: Props) {
  // Une idée en réserve (sans événement) n'a pas d'état « choisi ».
  const st = mode !== "owner" && idea.event_id ? status : undefined;
  const takenByOthers = !!st && st.total >= 100 && st.mine === 0;
  const price = formatPrice(idea.price_cents);
  const links = [...idea.idea_links].sort((a, b) => a.position - b.position);
  const thumb = ideaImageSrc(idea, "vignette");

  return (
    <article
      className={
        variant === "row"
          ? `${st && st.mine > 0 ? "bg-emerald-50/70" : "bg-white"}`
          : `card overflow-hidden ${st && st.mine > 0 ? "ring-2 ring-emerald-400" : ""}`
      }
    >
      <div className="flex gap-3 p-4">
        {thumb && <IdeaThumb thumb={thumb} full={ideaImageSrc(idea, "grande") ?? thumb} title={idea.title} />}
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <h3 className={`flex-1 font-extrabold leading-snug ${takenByOthers ? "text-muted line-through" : ""}`}>
              {idea.title}
              {idea.priority > 0 && (
                <span className="ml-1.5 text-sm text-amber-500" title="Priorité">{"★".repeat(idea.priority)}</span>
              )}
            </h3>
            {price && <span className="shrink-0 text-sm font-bold text-muted">{price}</span>}
            {canEdit && <EditButtons idea={idea} back={back} />}
          </div>

          {idea.description && <p className="mt-1 line-clamp-3 whitespace-pre-line text-sm text-stone-600">{idea.description}</p>}

          {(links.length > 0 || (mode !== "owner" && idea.is_secret)) && (
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              {links.map((l) => (
                <a
                  key={l.id}
                  href={l.url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="font-bold text-brand-600 hover:underline"
                >
                  {hostname(l.url)} ↗
                </a>
              ))}
              {mode !== "owner" && idea.is_secret && (
                <span className="text-xs text-violet-700" title="Invisible pour la personne qui reçoit">
                  🤫 suggérée par {member(idea.created_by)?.display_name ?? "?"}
                </span>
              )}
            </div>
          )}

          {st && mode === "manage" && <StatusLine status={st} member={member} />}
        </div>
      </div>

      {st && mode === "giver" && <GiverBar idea={idea} status={st} open={open} back={back} member={member} />}
      {footer && <div className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-2">{footer}</div>}
    </article>
  );
}

function EditButtons({ idea, back }: { idea: Idea; back: string }) {
  return (
    <span className="-mr-2 -mt-1 flex shrink-0">
      <Link
        href={`/idees/${idea.id}/modifier?back=${encodeURIComponent(back)}`}
        className="rounded-lg p-1.5 text-muted hover:bg-stone-100 hover:text-ink"
        title="Modifier"
        aria-label={`Modifier « ${idea.title} »`}
      >
        ✏️
      </Link>
      <form action={deleteIdea.bind(null, idea.id, back)}>
        <ConfirmButton
          title={`Supprimer « ${idea.title} » ?`}
          message="Elle disparaîtra de la liste. Si quelqu'un l'avait déjà choisie, il garde son choix et sera prévenu."
          confirmLabel="Supprimer"
          className="rounded-lg p-1.5 text-muted hover:bg-stone-100"
        >
          <span aria-label={`Supprimer « ${idea.title} »`}>🗑</span>
        </ConfirmButton>
      </form>
    </span>
  );
}

/** Qui a choisi, en une ligne (vue parent / idées déjà prises). */
function StatusLine({ status, member }: { status: IdeaStatus; member: Props["member"] }) {
  if (status.total === 0) return <p className="mt-2 text-xs font-semibold text-muted">Pas encore choisi</p>;
  const names = [
    ...(status.mine ? [`toi (${status.mine} %)`] : []),
    ...status.others.map((c) => `${member(c.member_id)?.display_name ?? "?"} (${c.percent} %)`),
  ];
  return (
    <p className={`mt-2 text-xs font-semibold ${status.total >= 100 ? "text-emerald-700" : "text-amber-700"}`}>
      {status.total >= 100 ? "✓ Choisi" : `${status.total} % pris`} par {names.join(", ")}
    </p>
  );
}

function GiverBar({
  idea,
  status,
  open,
  back,
  member,
}: {
  idea: Idea;
  status: IdeaStatus;
  open: boolean;
  back: string;
  member: Props["member"];
}) {
  const { total, mine, remaining } = status;
  const hidden = (
    <>
      <input type="hidden" name="idea" value={idea.id} />
      <input type="hidden" name="event" value={idea.event_id ?? ""} />
      <input type="hidden" name="back" value={back} />
    </>
  );

  if (!open) {
    return (
      <div className="border-t border-line px-4 py-2 text-xs font-semibold text-muted">
        {total >= 100 ? "🎉 Offert" : "Événement terminé"}
      </div>
    );
  }

  // Déjà pris en entier par d'autres : simple mention.
  if (total >= 100 && mine === 0) {
    return (
      <div className="px-4 pb-3">
        <StatusLine status={status} member={member} />
      </div>
    );
  }

  return (
    <div className="border-t border-line bg-stone-50/60 px-4 py-3">
      {total > 0 && total < 100 && (
        <div className="mb-2 flex h-1.5 overflow-hidden rounded-full bg-stone-200">
          {mine > 0 && <div className="bg-emerald-500" style={{ width: `${mine}%` }} />}
          <div className="bg-brand-500" style={{ width: `${total - mine}%` }} />
        </div>
      )}

      {mine > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-extrabold text-emerald-700">
            {mine === 100 ? "✓ Tu offres ce cadeau" : `✓ Tu participes à ${mine} %`}
          </span>
          {status.others.length > 0 && (
            <span className="text-xs text-muted">
              avec {status.others.map((c) => member(c.member_id)?.display_name).join(", ")}
            </span>
          )}
          <div className="ml-auto flex items-center gap-1">
            {remaining + mine > 1 && (
              <PercentForm label="Modifier" max={remaining + mine} value={mine} hidden={hidden} />
            )}
            <form action={withdraw}>
              {hidden}
              <ConfirmButton
                title="Annuler ton choix ?"
                message="L'idée redeviendra disponible pour les autres."
                confirmLabel="Oui, annuler"
                icon="↩️"
                cancelLabel="Garder"
                className="btn-ghost px-2 py-1 text-xs"
              >
                Annuler
              </ConfirmButton>
            </form>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {total === 0 ? (
            <form action={contribute}>
              {hidden}
              <input type="hidden" name="percent" value="100" />
              <SubmitButton className="btn-primary py-2" pendingText="…">🎁 Je le prends</SubmitButton>
            </form>
          ) : (
            <span className="text-sm font-bold">
              {total} % pris par {status.others.map((c) => member(c.member_id)?.display_name).join(", ")}
            </span>
          )}
          <PercentForm
            label={total === 0 ? "À plusieurs ?" : `Participer (reste ${remaining} %)`}
            max={remaining}
            value={total === 0 ? 50 : remaining}
            hidden={hidden}
            primary={total > 0}
          />
        </div>
      )}
    </div>
  );
}

function PercentForm({
  label,
  max,
  value,
  hidden,
  primary,
}: {
  label: string;
  max: number;
  value: number;
  hidden: React.ReactNode;
  primary?: boolean;
}) {
  return (
    <details className="group">
      <summary className={`${primary ? "btn-primary py-2" : "btn-ghost px-2 py-1.5 text-xs"} cursor-pointer`}>{label}</summary>
      <form action={contribute} className="mt-2 flex items-center gap-2">
        {hidden}
        <div className="relative">
          <input
            name="percent"
            type="number"
            inputMode="numeric"
            min={1}
            max={max}
            defaultValue={Math.min(value, max)}
            className="field w-24 pr-8"
            aria-label="Pourcentage"
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-bold text-muted">%</span>
        </div>
        <SubmitButton className="btn-primary py-2">OK</SubmitButton>
        <span className="text-xs text-muted">max {max} %</span>
      </form>
    </details>
  );
}
