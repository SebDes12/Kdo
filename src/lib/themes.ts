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

/**
 * Période du thème de Noël (jour, mois), bornes incluses : la carte « Noël approche » s'affiche
 * pendant cette période, et le thème d'avant revient le lendemain de la fin.
 * Pour changer les dates, il suffit de modifier ces deux lignes.
 */
export const NOEL_START = { day: 20, month: 11 }; // 20 novembre
export const NOEL_END = { day: 3, month: 1 }; // 3 janvier

const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

/** Date de fin lisible, ex. « 3 janvier ». */
export const NOEL_END_LABEL = `${NOEL_END.day === 1 ? "1er" : NOEL_END.day} ${MONTHS[NOEL_END.month - 1]}`;

const key = (month: number, day: number) => month * 100 + day;
const START = key(NOEL_START.month, NOEL_START.day);
const END = key(NOEL_END.month, NOEL_END.day);
/** La période passe-t-elle le cap du nouvel an (ex. novembre → janvier) ? */
const WRAPS = START > END;

export function isNoelSeason(d: Date): boolean {
  const k = key(d.getMonth() + 1, d.getDate());
  return WRAPS ? k >= START || k <= END : k >= START && k <= END;
}

/** Année de la saison (le début de l'année compte pour la saison commencée l'année précédente). */
export function seasonYear(d: Date): number {
  const k = key(d.getMonth() + 1, d.getDate());
  return WRAPS && k <= END ? d.getFullYear() - 1 : d.getFullYear();
}
