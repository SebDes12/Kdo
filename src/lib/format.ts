/** Date du jour (UTC), comme current_date côté base (UTC). */
export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function isActive(eventDate: string): boolean {
  return eventDate >= today();
}

export function daysUntil(eventDate: string): number {
  const ms = Date.parse(eventDate + "T00:00:00Z") - Date.parse(today() + "T00:00:00Z");
  return Math.round(ms / 86_400_000);
}

export function formatDate(d: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(d + "T00:00:00Z"));
}

export function formatCountdown(eventDate: string): string {
  const n = daysUntil(eventDate);
  if (n < 0) return "passé";
  if (n === 0) return "aujourd'hui";
  if (n === 1) return "demain";
  return `dans ${n} jours`;
}

export function formatPrice(cents: number | null): string | null {
  if (cents == null) return null;
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

export function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** Texte d'erreur lisible à partir d'une erreur Postgres (ou autre). */
export function errorMessage(e: unknown): string {
  const m = e instanceof Error ? e.message : typeof e === "string" ? e : "Une erreur est survenue";
  if (m.includes("row-level security") || m.includes("permission denied")) return "Action non autorisée";
  if (m.includes("duplicate key")) return "Cet élément existe déjà";
  if (m.includes("violates check constraint")) return "Valeur invalide";
  if (m.includes("invalid input syntax")) return "Valeur invalide";
  return m;
}

export function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

/** Période d'un événement : du début (event_date) à la fin (end_date). */
type Period = { event_date: string; end_date?: string | null };

export function endOf(e: Period): string {
  return e.end_date ?? e.event_date;
}

/** L'événement est encore ouvert (jusqu'à sa date de fin incluse). */
export function isOpen(e: Period): boolean {
  return endOf(e) >= today();
}

const UTC = (d: string) => new Date(d + "T00:00:00Z");

/** « jeu. 24 décembre 2026 » ou « 24–26 décembre 2026 ». */
export function formatPeriod(e: Period): string {
  if (endOf(e) === e.event_date) return formatDate(e.event_date);
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
    .formatRange(UTC(e.event_date), UTC(endOf(e)));
}

/** « dans 3 jours », « en cours jusqu'au 26 déc. », « dernier jour », « passé ». */
export function eventCountdown(e: Period): string {
  const end = endOf(e);
  if (e.event_date > today()) return formatCountdown(e.event_date);
  if (end < today()) return "passé";
  if (end === today()) return e.event_date === end ? "aujourd'hui" : "dernier jour";
  const short = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" }).format(UTC(end));
  return `en cours jusqu'au ${short}`;
}

/** « 24 nov. » à partir d'un horodatage ISO. */
export function formatDay(ts: string | null | undefined): string {
  if (!ts) return "";
  // Postgres renvoie « 2026-11-24 12:34:56.78+00 » : on le rend ISO
  const iso = ts.replace(" ", "T").replace(/([+-]\d\d)$/, "$1:00");
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "Europe/Paris" }).format(new Date(iso));
}
