import "server-only";
import { redirect } from "next/navigation";
import { errorMessage } from "@/lib/format";

/** N'accepte que des chemins internes pour éviter les redirections ouvertes. */
export function safePath(p: FormDataEntryValue | null | undefined, fallback = "/"): string {
  const s = typeof p === "string" ? p : "";
  return s.startsWith("/") && !s.startsWith("//") ? s : fallback;
}

function withParam(path: string, key: string, value: string): string {
  const [base, hash] = path.split("#");
  const url = new URL(base, "http://x");
  url.searchParams.delete("erreur");
  url.searchParams.delete("ok");
  url.searchParams.set(key, value);
  return url.pathname + url.search + (hash ? "#" + hash : "");
}

export function redirectError(path: string, message: string): never {
  redirect(withParam(path, "erreur", message));
}

export function redirectOk(path: string, message: string): never {
  redirect(withParam(path, "ok", message));
}

/**
 * Exécute une opération en base ; en cas d'erreur, revient sur `back`
 * avec un message lisible.
 */
export async function attempt<T>(back: string, op: () => Promise<T>): Promise<T> {
  try {
    return await op();
  } catch (e) {
    redirectError(back, errorMessage(e));
  }
}
