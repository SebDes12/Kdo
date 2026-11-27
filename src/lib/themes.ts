/** Thèmes d'affichage. Les couleurs sont définies dans globals.css ([data-theme="…"]). */
export const THEMES = [
  { id: "or", name: "Mauve & or", color: "#4a3657" },
  { id: "argent", name: "Mauve argenté", color: "#4a3657" },
  { id: "sapin", name: "Sapin & cuivre", color: "#173f2f" },
  { id: "nuit", name: "Nuit", color: "#1e1b4b" },
  { id: "sunset", name: "Sunset", color: "#7b2cbf" },
  { id: "noel", name: "Noël", color: "#a4161a" },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];

export const DEFAULT_THEME: ThemeId = "or";
export const THEME_COOKIE = "kdo-theme";

export function isTheme(v: unknown): v is ThemeId {
  return THEMES.some((t) => t.id === v);
}

export function themeColor(id: ThemeId): string {
  return THEMES.find((t) => t.id === id)?.color ?? THEMES[0].color;
}

/** Période où l'on propose le thème de Noël : du 15 novembre au 6 janvier. */
export function isNoelSeason(d: Date): boolean {
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return m === 12 || (m === 11 && day >= 15) || (m === 1 && day <= 6);
}

/** Année de la saison (janvier compte pour la saison de l'année précédente). */
export function seasonYear(d: Date): number {
  return d.getMonth() === 0 ? d.getFullYear() - 1 : d.getFullYear();
}
