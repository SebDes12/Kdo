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
