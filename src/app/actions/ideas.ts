"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { errorMessage } from "@/lib/format";
import { redirectError, redirectOk, safePath } from "@/lib/redirect";

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
  const { supabase, me, isParentOf } = await getSession();
  const id = str(fd, "id") || null;
  const back = safePath(fd.get("back"));
  const formPath = safePath(fd.get("form"), back);
  const beneficiary = str(fd, "beneficiary");

  const title = str(fd, "title");
  if (!title) redirectError(formPath, "Le titre est obligatoire");
  const rawLinks = fd.getAll("links").map(String).filter((l) => l.trim());
  const links = rawLinks.map(normalizeUrl);
  if (links.some((l) => l === null)) redirectError(formPath, "Un des liens n'est pas valide");

  // Règle : pour soi = visible ; parent = au choix ; autre personne = secret.
  const isSecret =
    beneficiary === me.id ? false : isParentOf(beneficiary) ? fd.get("secret") === "on" : true;

  const fields = {
    title,
    description: str(fd, "description") || null,
    price_cents: parsePrice(str(fd, "price")),
    priority: Math.min(3, Math.max(0, Number(fd.get("priority") ?? 0) || 0)),
    image_url: normalizeUrl(str(fd, "image")),
    event_id: str(fd, "event") || null,
    is_secret: isSecret,
  };

  let ideaId = id;
  if (id) {
    const { data, error } = await supabase.from("ideas").update(fields).eq("id", id).select("id");
    if (error || !data?.length) redirectError(formPath, errorMessage(error ?? { message: "Action non autorisée" }));
    await supabase.from("idea_links").delete().eq("idea_id", id);
  } else {
    const { data, error } = await supabase
      .from("ideas")
      .insert({ ...fields, beneficiary_id: beneficiary, created_by: me.id })
      .select("id")
      .single();
    if (error || !data) redirectError(formPath, errorMessage(error));
    ideaId = data.id;
  }
  if (links.length) {
    const { error } = await supabase
      .from("idea_links")
      .insert(links.map((url, position) => ({ idea_id: ideaId, url, position })));
    if (error) redirectError(formPath, errorMessage(error));
  }
  revalidatePath("/", "layout");
  redirectOk(back, id ? "Idée modifiée" : isSecret && beneficiary !== me.id && !isParentOf(beneficiary)
    ? "Idée suggérée (elle reste secrète pour la personne)" : "Idée ajoutée");
}

export async function deleteIdea(ideaId: string, back: string) {
  const { supabase } = await getSession();
  const path = safePath(back);
  const { data, error } = await supabase.from("ideas").delete().eq("id", ideaId).select("id");
  if (error || !data?.length) redirectError(path, "Action non autorisée");
  revalidatePath("/", "layout");
  redirectOk(path, "Idée supprimée");
}

/** Report d'une idée (en réserve ou d'un événement passé) vers un événement. */
export async function moveIdea(fd: FormData) {
  const { supabase } = await getSession();
  const back = safePath(fd.get("back"));
  const { data, error } = await supabase
    .from("ideas")
    .update({ event_id: str(fd, "event") || null })
    .eq("id", str(fd, "idea"))
    .select("id");
  if (error || !data?.length) redirectError(back, errorMessage(error ?? { message: "Action non autorisée" }));
  revalidatePath("/", "layout");
  redirectOk(back, "Idée reportée");
}

/** Je prends (100 %) ou je participe (x %). Remplace ma participation précédente. */
export async function contribute(fd: FormData) {
  const { supabase, me } = await getSession();
  const back = safePath(fd.get("back"));
  const percent = Math.round(Number(fd.get("percent")));
  if (!Number.isFinite(percent) || percent < 1 || percent > 100) {
    redirectError(back, "Indique un pourcentage entre 1 et 100");
  }
  const { error } = await supabase.from("contributions").upsert({
    idea_id: str(fd, "idea"),
    event_id: str(fd, "event"),
    member_id: me.id,
    percent,
  });
  if (error) {
    const m = error.message.match(/Il ne reste que (\d+) %/);
    redirectError(back, m ? `Trop tard : il ne reste que ${m[1]} % sur cette idée` : errorMessage(error));
  }
  revalidatePath("/", "layout");
  redirect(back);
}

export async function withdraw(fd: FormData) {
  const { supabase, me } = await getSession();
  const back = safePath(fd.get("back"));
  const { error } = await supabase
    .from("contributions")
    .delete()
    .eq("idea_id", str(fd, "idea"))
    .eq("event_id", str(fd, "event"))
    .eq("member_id", me.id);
  if (error) redirectError(back, errorMessage(error));
  revalidatePath("/", "layout");
  redirectOk(back, "Participation annulée");
}
