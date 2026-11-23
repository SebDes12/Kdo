import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Retour des liens envoyés par e-mail par Supabase (mot de passe oublié). */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const next = searchParams.get("next") ?? "/";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";
  const supabase = await createClient();

  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  let ok = false;
  if (code) {
    ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  } else if (tokenHash && type) {
    ok = !(await supabase.auth.verifyOtp({ type, token_hash: tokenHash })).error;
  }

  const url = request.nextUrl.clone();
  url.search = "";
  url.hash = "";
  if (ok) {
    const [path, hash] = safeNext.split("#");
    url.pathname = path;
    if (hash) url.hash = hash;
  } else {
    url.pathname = "/connexion";
    url.searchParams.set("erreur", "Lien expiré ou invalide");
  }
  return NextResponse.redirect(url);
}
