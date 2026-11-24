"use server";

import { redirect } from "next/navigation";
import {
  clearSessionCookie,
  hashPassword,
  sessionTokenHash,
  sha256,
  startSession,
  verifyPassword,
} from "@/lib/auth";
import { asAdmin, type Sql } from "@/lib/db";
import { redirectError, redirectOk } from "@/lib/redirect";
import { currentMemberId } from "@/lib/session";

function str(fd: FormData, key: string): string {
  return String(fd.get(key) ?? "").trim();
}

/** Erreur métier : son message est affiché tel quel à l'utilisateur. */
class UserError extends Error {}

export async function login(fd: FormData) {
  const identifier = str(fd, "identifiant").toLowerCase();
  const password = String(fd.get("password") ?? "");
  const ok = await asAdmin(async (q) => {
    const [acc] = identifier.includes("@")
      ? await q<{ member_id: string; password_hash: string }>(
          "select member_id, password_hash from accounts where email = $1",
          [identifier],
        )
      : await q<{ member_id: string; password_hash: string }>(
          `select a.member_id, a.password_hash from accounts a
           join members m on m.id = a.member_id where m.login = $1`,
          [identifier],
        );
    if (!acc || !(await verifyPassword(password, acc.password_hash))) return false;
    await startSession(q, acc.member_id);
    return true;
  });
  if (!ok) redirectError("/connexion", "Identifiant ou mot de passe incorrect");
  redirect("/");
}

export async function logout() {
  const tokenHash = await sessionTokenHash();
  if (tokenHash) await asAdmin((q) => q("delete from sessions where token_hash = $1", [tokenHash]));
  await clearSessionCookie();
  redirect("/connexion");
}

type NewAccount = { name: string; email: string; password: string };

function readAccount(fd: FormData, back: string): NewAccount {
  const acc = { name: str(fd, "name"), email: str(fd, "email").toLowerCase(), password: String(fd.get("password") ?? "") };
  if (!acc.name) redirectError(back, "Indique ton prénom");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(acc.email)) redirectError(back, "Adresse e-mail invalide");
  if (acc.password.length < 8) redirectError(back, "Le mot de passe doit faire au moins 8 caractères");
  return acc;
}

/** Crée le membre adulte et son compte, puis ouvre la session. */
async function createAdult(q: Sql, acc: NewAccount): Promise<string> {
  const [taken] = await q("select 1 from accounts where email = $1", [acc.email]);
  if (taken) throw new UserError("Un compte existe déjà avec cet e-mail");
  const [member] = await q<{ id: string }>("insert into members (display_name) values ($1) returning id", [acc.name]);
  await q("insert into accounts (member_id, email, password_hash) values ($1, $2, $3)", [
    member.id,
    acc.email,
    await hashPassword(acc.password),
  ]);
  await startSession(q, member.id);
  return member.id;
}

async function run(back: string, fn: () => Promise<void>) {
  try {
    await fn();
  } catch (e) {
    if (e instanceof UserError) redirectError(back, e.message);
    throw e;
  }
}

/** Premier compte de la famille : possible uniquement si la base est vide. */
export async function bootstrap(fd: FormData) {
  const back = "/bienvenue";
  const acc = readAccount(fd, back);
  await run(back, () =>
    asAdmin(async (q) => {
      await q("lock table members in exclusive mode");
      const [{ n }] = await q<{ n: number }>("select count(*)::int as n from members");
      if (n > 0) throw new UserError("La famille existe déjà : demande une invitation");
      await createAdult(q, acc);
    }),
  );
  redirect("/famille?bienvenue=1");
}

export async function acceptInvitation(token: string, fd: FormData) {
  const back = `/invitation/${encodeURIComponent(token)}`;
  const acc = readAccount(fd, back);
  await run(back, () =>
    asAdmin(async (q) => {
      const [inv] = await q(
        `select token from invitations
         where token = $1 and used_at is null and expires_at > now() for update`,
        [token],
      );
      if (!inv) throw new UserError("Cette invitation n'est plus valable");
      const memberId = await createAdult(q, acc);
      await q(
        `insert into group_members (group_id, member_id)
         select group_id, $2 from invitation_groups where token = $1 on conflict do nothing`,
        [token, memberId],
      );
      await q("update invitations set used_at = now(), used_by = $2 where token = $1", [token, memberId]);
    }),
  );
  redirect("/?bienvenue=1");
}

/** Un enfant active son compte via le lien envoyé par son parent. */
export async function activateChild(token: string, fd: FormData) {
  const back = `/activer/${encodeURIComponent(token)}`;
  const wanted = str(fd, "login").toLowerCase();
  const password = String(fd.get("password") ?? "");
  if (password.length < 6) redirectError(back, "Le mot de passe doit faire au moins 6 caractères");
  const hash = await hashPassword(password);
  await run(back, () =>
    asAdmin(async (q) => {
      const [link] = await q<{ member_id: string; login: string | null }>(
        `update login_links l set used_at = now()
         from members m
         where l.token_hash = $1 and l.used_at is null and l.expires_at > now()
           and m.id = l.member_id and m.is_child
         returning l.member_id, m.login`,
        [sha256(token)],
      );
      if (!link) throw new UserError("Ce lien n'est plus valable : demande-en un nouveau à ton parent");
      if (link.login) {
        await q("update accounts set password_hash = $2 where member_id = $1", [link.member_id, hash]);
      } else {
        if (!/^[a-z0-9][a-z0-9._-]{1,30}$/.test(wanted)) {
          throw new UserError("Pseudo invalide : lettres minuscules, chiffres, . _ - (2 à 31 caractères)");
        }
        const [taken] = await q("select 1 from members where login = $1", [wanted]);
        if (taken) throw new UserError("Ce pseudo est déjà pris, choisis-en un autre");
        await q("update members set login = $2 where id = $1", [link.member_id, wanted]);
        await q("insert into accounts (member_id, password_hash) values ($1, $2)", [link.member_id, hash]);
      }
      await q("delete from sessions where member_id = $1", [link.member_id]);
      await startSession(q, link.member_id);
    }),
  );
  redirect("/?bienvenue=1");
}

/** Nouveau mot de passe via un lien généré par un adulte de la famille. */
export async function resetPassword(token: string, fd: FormData) {
  const back = `/reinitialiser/${encodeURIComponent(token)}`;
  const password = String(fd.get("password") ?? "");
  if (password.length < 8) redirectError(back, "Le mot de passe doit faire au moins 8 caractères");
  await run(back, () =>
    asAdmin(async (q) => {
      const [reset] = await q<{ member_id: string }>(
        `update password_resets set used_at = now()
         where token_hash = $1 and used_at is null and expires_at > now()
         returning member_id`,
        [sha256(token)],
      );
      if (!reset) throw new UserError("Ce lien n'est plus valable : demande-en un nouveau");
      await q("update accounts set password_hash = $2 where member_id = $1", [reset.member_id, await hashPassword(password)]);
      await q("delete from sessions where member_id = $1", [reset.member_id]);
      await startSession(q, reset.member_id);
    }),
  );
  redirectOk("/", "Mot de passe modifié");
}

export async function updatePassword(fd: FormData) {
  const back = "/compte";
  const current = String(fd.get("current") ?? "");
  const password = String(fd.get("password") ?? "");
  if (password.length < 8) redirectError(back, "Le nouveau mot de passe doit faire au moins 8 caractères");
  const memberId = await currentMemberId();
  if (!memberId) redirect("/connexion");
  await run(back, () =>
    asAdmin(async (q) => {
      const [acc] = await q<{ password_hash: string }>("select password_hash from accounts where member_id = $1", [memberId]);
      if (!acc || !(await verifyPassword(current, acc.password_hash))) {
        throw new UserError("Mot de passe actuel incorrect");
      }
      await q("update accounts set password_hash = $2 where member_id = $1", [memberId, await hashPassword(password)]);
    }),
  );
  redirectOk(back, "Mot de passe modifié");
}
