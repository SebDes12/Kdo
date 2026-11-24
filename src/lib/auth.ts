import "server-only";
import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/auth-cookie";
import type { Sql } from "@/lib/db";

const SESSION_DAYS = 180;

function scryptAsync(password: string, salt: Buffer, length: number): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(password, salt, length, (err, key) => (err ? reject(err) : resolve(key))),
  );
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scryptAsync(password, salt, 64);
  return `scrypt$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algo, salt, hash] = stored.split("$");
  if (algo !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64");
  const actual = await scryptAsync(password, Buffer.from(salt, "base64"), expected.length);
  return timingSafeEqual(actual, expected);
}

export function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

/** Jeton aléatoire (invitations, liens de réinitialisation, sessions). */
export function randomToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Crée une session pour le membre et pose le cookie (dans une action serveur). */
export async function startSession(q: Sql, memberId: string): Promise<void> {
  const token = randomToken();
  await q(
    `insert into sessions (token_hash, member_id, expires_at)
     values ($1, $2, now() + make_interval(days => $3))`,
    [sha256(token), memberId, SESSION_DAYS],
  );
  await q("delete from sessions where member_id = $1 and expires_at < now()", [memberId]);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 86_400,
  });
}

/** Empreinte du jeton de session présent dans les cookies, ou null. */
export async function sessionTokenHash(): Promise<string | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? sha256(token) : null;
}

export async function clearSessionCookie(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}
