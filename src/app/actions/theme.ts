"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import { isNoelSeason, isTheme, type ThemeId } from "@/lib/themes";

/**
 * Enregistre le thème du membre connecté.
 * `restore` : thème à retrouver après les fêtes (quand Noël est activé depuis la proposition).
 */
export async function saveTheme(theme: string, restore?: string | null): Promise<void> {
  if (!isTheme(theme)) return;
  const back = restore && isTheme(restore) && restore !== theme ? restore : null;
  const { q, me } = await getSession();
  await q("update members set theme = $1, theme_restore = $2 where id = $3", [theme, back, me.id]);
  revalidatePath("/", "layout");
}

/** Après les fêtes : revient au thème d'avant si Noël venait de la proposition de saison. */
export async function restoreSeasonTheme(): Promise<ThemeId | null> {
  if (isNoelSeason(new Date())) return null;
  const { q, me } = await getSession();
  const rows = await q<{ theme: string }>(
    `update members set theme = theme_restore, theme_restore = null
     where id = $1 and theme = 'noel' and theme_restore is not null
     returning theme`,
    [me.id],
  );
  revalidatePath("/", "layout");
  return rows[0] && isTheme(rows[0].theme) ? rows[0].theme : null;
}

/** La visite guidée a été vue (ou passée) : elle ne se relance plus d'elle-même. */
export async function finishTour(): Promise<void> {
  const { q, me } = await getSession();
  await q("update members set tour_done = true where id = $1 and not tour_done", [me.id]);
}
