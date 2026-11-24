"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { errorMessage } from "@/lib/format";
import { attempt, redirectError, redirectOk, safePath } from "@/lib/redirect";
import { getSession } from "@/lib/session";

function str(fd: FormData, key: string): string {
  return String(fd.get(key) ?? "").trim();
}

function parsePrice(raw: string): number | null {
  if (!raw) return null;
  const n = Number(raw.replace(/\s|€/g, "").replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
}

function normalizeUrl(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  const withScheme = /^https?:\/\//i.test(s) ? s : `https://${s}`;
  try {
    return new URL(withScheme).toString();
  } catch {
    return null;
  }
}

/** Création ou modification d'une idée (formulaire unique). */
export async function saveIdea(fd: FormData) {
  const { tx, me, isParentOf } = await getSession();
  const id = str(fd, "id") || null;
  const back = safePath(fd.get("back"));
  const formPath = safePath(fd.get("form"), back);
  const beneficiary = str(fd, "beneficiary");

  const title = str(fd, "title");
  if (!title) redirectError(formPath, "Le titre est obligatoire");
  const links = fd.getAll("links").map(String).filter((l) => l.trim()).map(normalizeUrl);
  if (links.some((l) => l === null)) redirectError(formPath, "Un des liens n'est pas valide");

  // Règle : pour soi = visible ; parent = au choix ; autre personne = secret.
  const isSecret = beneficiary === me.id ? false : isParentOf(beneficiary) ? fd.get("secret") === "on" : true;
  const fields = [
    title,
    str(fd, "description") || null,
    parsePrice(str(fd, "price")),
    Math.min(3, Math.max(0, Number(fd.get("priority") ?? 0) || 0)),
    normalizeUrl(str(fd, "image")),
    str(fd, "event") || null,
    isSecret,
  ];

  const saved = await attempt(formPath, () =>
    tx(async (q) => {
      let ideaId = id;
      if (id) {
        const rows = await q(
          `update ideas set title = $2, description = $3, price_cents = $4, priority = $5,
             image_url = $6, event_id = $7, is_secret = $8
           where id = $1 returning id`,
          [id, ...fields],
        );
        if (!rows.length) return false;
        await q("delete from idea_links where idea_id = $1", [id]);
      } else {
        const [row] = await q<{ id: string }>(
          `insert into ideas (title, description, price_cents, priority, image_url, event_id, is_secret,
             beneficiary_id, created_by)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9) returning id`,
          [...fields, beneficiary, me.id],
        );
        ideaId = row.id;
      }
      if (links.length) {
        await q(
          `insert into idea_links (idea_id, url, position)
           select $1, u.url, u.ord - 1 from unnest($2::text[]) with ordinality as u(url, ord)`,
          [ideaId, links],
        );
      }
      return true;
    }),
  );
  if (!saved) redirectError(formPath, "Action non autorisée");
  revalidatePath("/", "layout");
  redirectOk(
    back,
    id
      ? "Idée modifiée"
      : isSecret && beneficiary !== me.id && !isParentOf(beneficiary)
        ? "Idée suggérée (elle reste secrète pour la personne)"
        : "Idée ajoutée",
  );
}

export async function deleteIdea(ideaId: string, back: string) {
  const { q } = await getSession();
  const path = safePath(back);
  const rows = await attempt(path, () => q("delete from ideas where id = $1 returning id", [ideaId]));
  if (!rows.length) redirectError(path, "Action non autorisée");
  revalidatePath("/", "layout");
  redirectOk(path, "Idée supprimée");
}

/** Report d'une idée (en réserve ou d'un événement passé) vers un événement. */
export async function moveIdea(fd: FormData) {
  const { q } = await getSession();
  const back = safePath(fd.get("back"));
  const rows = await attempt(back, () =>
    q("update ideas set event_id = $2 where id = $1 returning id", [str(fd, "idea"), str(fd, "event") || null]),
  );
  if (!rows.length) redirectError(back, "Action non autorisée");
  revalidatePath("/", "layout");
  redirectOk(back, "Idée reportée");
}

/** Je prends (100 %) ou je participe (x %). Remplace ma participation précédente. */
export async function contribute(fd: FormData) {
  const { q, me } = await getSession();
  const back = safePath(fd.get("back"));
  const percent = Math.round(Number(fd.get("percent")));
  if (!Number.isFinite(percent) || percent < 1 || percent > 100) {
    redirectError(back, "Indique un pourcentage entre 1 et 100");
  }
  try {
    await q(
      `insert into contributions (idea_id, event_id, member_id, percent) values ($1, $2, $3, $4)
       on conflict (idea_id, event_id, member_id) do update set percent = excluded.percent`,
      [str(fd, "idea"), str(fd, "event"), me.id, percent],
    );
  } catch (e) {
    const m = errorMessage(e).match(/Il ne reste que (\d+) %/);
    redirectError(back, m ? `Trop tard : il ne reste que ${m[1]} % sur cette idée` : errorMessage(e));
  }
  revalidatePath("/", "layout");
  redirect(back);
}

export async function withdraw(fd: FormData) {
  const { q, me } = await getSession();
  const back = safePath(fd.get("back"));
  await attempt(back, () =>
    q("delete from contributions where idea_id = $1 and event_id = $2 and member_id = $3", [
      str(fd, "idea"),
      str(fd, "event"),
      me.id,
    ]),
  );
  revalidatePath("/", "layout");
  redirectOk(back, "Participation annulée");
}
