import Link from "next/link";
import { contribute, deleteIdea, withdraw } from "@/app/actions/ideas";
import { ConfirmButton, SubmitButton } from "@/components/client";
import { Avatar, Badge } from "@/components/ui";
import { formatPrice, hostname } from "@/lib/format";
import type { IdeaStatus } from "@/lib/ideas";
import type { Idea, Member } from "@/lib/types";

type Props = {
  idea: Idea;
  /** "owner" : le bénéficiaire regarde sa liste (aucun état visible). */
  mode: "owner" | "giver";
  status?: IdeaStatus;
  /** L'événement est en cours : on peut encore choisir. */
  open: boolean;
  canEdit: boolean;
  back: string;
  member: (id: string | null | undefined) => Member | undefined;
  footer?: React.ReactNode;
};

export function IdeaCard({ idea, mode, status, open, canEdit, back, member, footer }: Props) {
  const giver = mode === "giver" && status;
  const full = giver && status.total >= 100;
  const mineFull = giver && status.mine > 0 && full;
  const price = formatPrice(idea.price_cents);
  const links = [...idea.idea_links].sort((a, b) => a.position - b.position);
  const author = member(idea.created_by);

  return (
    <article
      className={`card relative overflow-hidden transition ${
        full && !status.mine ? "opacity-55 grayscale" : ""
      } ${mineFull ? "ring-2 ring-emerald-400" : ""}`}
    >
      <div className="flex gap-3 p-4">
        {idea.image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={idea.image_url} alt="" className="size-20 shrink-0 rounded-xl border border-line object-cover" loading="lazy" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className={`font-extrabold leading-snug ${full && !status.mine ? "line-through decoration-2" : ""}`}>
              {idea.priority > 0 && <span className="mr-1 text-amber-500" title="Priorité">{"★".repeat(idea.priority)}</span>}
              {idea.title}
            </h3>
            {price && <span className="shrink-0 text-sm font-bold text-muted">{price}</span>}
          </div>

          {idea.description && <p className="mt-1 whitespace-pre-line text-sm text-stone-600">{idea.description}</p>}

          {links.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {links.map((l) => (
                <a
                  key={l.id}
                  href={l.url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="inline-flex max-w-full items-center gap-1 truncate rounded-lg bg-stone-100 px-2 py-1 text-xs font-bold text-stone-700 hover:bg-stone-200"
                >
                  🛒 {hostname(l.url)} ↗
                </a>
              ))}
            </div>
          )}

          {mode === "giver" && idea.is_secret && (
            <p className="mt-2">
              <Badge tone="violet">🤫 Suggestion secrète{author ? ` de ${author.display_name}` : ""}</Badge>
            </p>
          )}
        </div>
      </div>

      {giver && <GiverBar idea={idea} status={status} open={open} back={back} member={member} />}

      {(canEdit || footer) && (
        <div className="flex flex-wrap items-center gap-1 border-t border-line bg-stone-50/60 px-2 py-1.5">
          {footer}
          {canEdit && (
            <>
              <Link href={`/idees/${idea.id}/modifier?back=${encodeURIComponent(back)}`} className="btn-ghost py-1.5 text-xs">
                ✏️ Modifier
              </Link>
              <form action={deleteIdea.bind(null, idea.id, back)}>
                <ConfirmButton message={`Supprimer « ${idea.title} » ?`} className="btn-ghost py-1.5 text-xs">
                  🗑 Supprimer
                </ConfirmButton>
              </form>
            </>
          )}
        </div>
      )}
    </article>
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
  const { total, mine, others, remaining } = status;
  const maxForMe = remaining + mine;
  const hidden = (
    <>
      <input type="hidden" name="idea" value={idea.id} />
      <input type="hidden" name="event" value={idea.event_id ?? ""} />
      <input type="hidden" name="back" value={back} />
    </>
  );

  return (
    <div className="border-t border-line px-4 py-3">
      {total > 0 && (
        <div className="mb-2.5">
          <div className="mb-1.5 flex h-2 overflow-hidden rounded-full bg-stone-100">
            {mine > 0 && <div className="bg-emerald-500" style={{ width: `${mine}%` }} />}
            <div className="bg-brand-500" style={{ width: `${total - mine}%` }} />
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold text-muted">
            {mine > 0 && <span className="text-emerald-700">Toi : {mine} %</span>}
            {others.map((c) => (
              <span key={c.member_id} className="inline-flex items-center gap-1">
                <Avatar member={member(c.member_id)} size="sm" />
                {member(c.member_id)?.display_name ?? "?"} : {c.percent} %
              </span>
            ))}
          </div>
        </div>
      )}

      {!open ? (
        total >= 100 ? <Badge tone="green">🎉 Offert</Badge> : <span className="text-xs text-muted">Événement terminé</span>
      ) : mine > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="green">{mine === 100 ? "✓ Tu offres ce cadeau" : `✓ Tu participes à ${mine} %`}</Badge>
          <div className="ml-auto flex gap-1">
            {maxForMe > 1 && <PercentForm label="Modifier" max={maxForMe} value={mine} hidden={hidden} />}
            <form action={withdraw}>
              {hidden}
              <ConfirmButton message="Annuler ta participation ?" className="btn-ghost py-1.5 text-xs">
                Annuler
              </ConfirmButton>
            </form>
          </div>
        </div>
      ) : total >= 100 ? (
        <Badge>Déjà choisi</Badge>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {total === 0 ? (
            <form action={contribute}>
              {hidden}
              <input type="hidden" name="percent" value="100" />
              <SubmitButton className="btn-primary py-2" pendingText="…">🎁 Je le prends</SubmitButton>
            </form>
          ) : (
            <span className="text-sm font-bold">Reste {remaining} %</span>
          )}
          <PercentForm
            label={total === 0 ? "Participer en partie" : "Participer"}
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
      <summary className={`${primary ? "btn-primary py-2" : "btn-ghost py-1.5 text-xs"} cursor-pointer`}>{label}</summary>
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
