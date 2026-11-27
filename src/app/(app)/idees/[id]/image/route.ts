import type { NextRequest } from "next/server";
import { sessionTokenHash } from "@/lib/auth";
import { asUser } from "@/lib/db";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Photo d'une idée, lue sous l'identité de l'utilisateur (RLS) : une idée
 * secrète renvoie 404 à la personne qui la reçoit.
 * L'adresse contient la version (?v=…) : le navigateur la garde un an et ne
 * la redemande jamais à la base tant que la photo ne change pas.
 */
export async function GET(request: NextRequest, ctx: RouteContext<"/idees/[id]/image">) {
  const { id } = await ctx.params;
  const tokenHash = await sessionTokenHash();
  if (!tokenHash) return new Response(null, { status: 401 });
  if (!UUID.test(id)) return new Response(null, { status: 404 });

  const column = request.nextUrl.searchParams.get("taille") === "grande" ? "data" : "thumb";
  const [row] = await asUser(tokenHash, (q) =>
    q<{ mime: string; bytes: Buffer }>(`select mime, ${column} as bytes from idea_images where idea_id = $1`, [id]),
  );
  if (!row) return new Response(null, { status: 404, headers: { "Cache-Control": "private, no-store" } });

  return new Response(new Uint8Array(row.bytes), {
    headers: {
      "Content-Type": row.mime,
      "Content-Length": String(row.bytes.length),
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'",
    },
  });
}
