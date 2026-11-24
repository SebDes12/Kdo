"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { hashPassword } from "@/lib/auth";
import { asAdmin } from "@/lib/db";
import { errorMessage } from "@/lib/format";
import { attempt, redirectError, redirectOk, safePath } from "@/lib/redirect";
import { getSession } from "@/lib/session";

function str(fd: FormData, key: string): string {
  return String(fd.get(key) ?? "").trim();
}

function done(path: string, msg: string): never {
  revalidatePath("/", "layout");
  redirectOk(path, msg);
}

const NOT_ALLOWED = "Action non autorisée";

// ---------------------------------------------------------------- Enfants

export async function createChild(fd: FormData) {
  const { tx, me } = await getSession();
  const name = str(fd, "name");
  if (!name) redirectError("/famille", "Indique le prénom de l'enfant");
  // L'enfant rejoint d'office les groupes de son parent (modifiable ensuite).
  const [row] = await attempt("/famille", () =>
    tx(async (q) => {
      const rows = await q<{ id: string }>("select create_child($1) as id", [name]);
      const coparent = str(fd, "coparent");
      if (coparent) await q("select add_coparent($1, $2)", [rows[0].id, coparent]);
      await q(
        `insert into group_members (group_id, member_id)
         select group_id, $1 from group_members where member_id = $2 on conflict do nothing`,
        [rows[0].id, me.id],
      );
      return rows;
    }),
  );
  revalidatePath("/", "layout");
  redirect(`/famille/enfants/${row.id}?ok=${encodeURIComponent("Enfant ajouté")}`);
}

/** Supprime le profil d'un enfant (doublon…) : ses idées et ses choix disparaissent aussi. */
export async function deleteChild(childId: string) {
  const { q } = await getSession();
  await attempt(`/famille/enfants/${childId}`, () => q("select delete_child($1)", [childId]));
  done("/famille", "Enfant supprimé");
}

/** Crée ou met à jour l'identifiant de connexion d'un enfant (pseudo + mot de passe). */
export async function setChildLogin(childId: string, fd: FormData) {
  const { isParentOf, member } = await getSession();
  const back = `/famille/enfants/${childId}`;
  const child = member(childId);
  if (!child || !isParentOf(childId)) redirectError(back, NOT_ALLOWED);

  const loginName = (child.login ?? str(fd, "login")).toLowerCase();
  const password = String(fd.get("password") ?? "");
  if (!/^[a-z0-9][a-z0-9._-]{1,30}$/.test(loginName)) {
    redirectError(back, "Pseudo invalide : lettres minuscules, chiffres, . _ - (2 à 31 caractères)");
  }
  if (password.length < 6) redirectError(back, "Le mot de passe doit faire au moins 6 caractères");
  const hash = await hashPassword(password);

  if (child.login) {
    await asAdmin((q) => q("update accounts set password_hash = $2 where member_id = $1", [childId, hash]));
    done(back, "Mot de passe modifié");
  }
  const result = await asAdmin(async (q) => {
    const [taken] = await q("select 1 from members where login = $1", [loginName]);
    if (taken) return "taken";
    await q("update members set login = $2 where id = $1", [childId, loginName]);
    await q("insert into accounts (member_id, password_hash) values ($1, $2)", [childId, hash]);
    return "ok";
  });
  if (result === "taken") redirectError(back, "Ce pseudo est déjà pris");
  done(back, "Identifiant créé");
}

export async function renameMember(memberId: string, fd: FormData) {
  const { q } = await getSession();
  const back = safePath(fd.get("back"), "/famille");
  const name = str(fd, "name");
  if (!name) redirectError(back, "Le nom ne peut pas être vide");
  const rows = await attempt(back, () => q("update members set display_name = $2 where id = $1 returning id", [memberId, name]));
  if (!rows.length) redirectError(back, NOT_ALLOWED);
  done(back, "Nom modifié");
}

export async function addCoparent(childId: string, fd: FormData) {
  const { q } = await getSession();
  const back = `/famille/enfants/${childId}`;
  await attempt(back, () => q("select add_coparent($1, $2)", [childId, str(fd, "parent")]));
  done(back, "Parent ajouté");
}

export async function removeCoparent(childId: string, parentId: string) {
  const { q } = await getSession();
  const back = `/famille/enfants/${childId}`;
  await attempt(back, () => q("select remove_coparent($1, $2)", [childId, parentId]));
  done(back, "Parent retiré");
}

export async function emancipate(childId: string) {
  const { q } = await getSession();
  await attempt(`/famille/enfants/${childId}`, () => q("select emancipate_child($1)", [childId]));
  done("/famille", "Le compte est désormais autonome");
}

// ----------------------------------------------------- Groupes d'un enfant

/** Ajoute / retire un membre (soi-même ou son enfant) d'un groupe. */
export async function toggleGroupMember(fd: FormData) {
  const { q } = await getSession();
  const back = safePath(fd.get("back"), "/famille");
  const group = str(fd, "group");
  const memberId = str(fd, "member");
  const on = str(fd, "on") === "1";
  await attempt(back, () =>
    on
      ? q("insert into group_members (group_id, member_id) values ($1, $2) on conflict do nothing", [group, memberId])
      : q("delete from group_members where group_id = $1 and member_id = $2", [group, memberId]),
  );
  revalidatePath("/", "layout");
  redirect(back);
}

// ----------------------------------------------------------------- Groupes

export async function createGroup(fd: FormData) {
  const { q } = await getSession();
  const name = str(fd, "name");
  if (!name) redirectError("/famille", "Indique un nom de groupe");
  const [row] = await attempt("/famille", () => q<{ id: string }>("select create_group($1) as id", [name]));
  revalidatePath("/", "layout");
  redirect(`/famille/groupes/${row.id}?ok=${encodeURIComponent("Groupe créé")}`);
}

export async function renameGroup(groupId: string, fd: FormData) {
  const { q } = await getSession();
  const back = `/famille/groupes/${groupId}`;
  const rows = await attempt(back, () =>
    q("update groups set name = $2 where id = $1 returning id", [groupId, str(fd, "name")]),
  );
  if (!rows.length) redirectError(back, "Seuls les administrateurs peuvent renommer le groupe");
  done(back, "Groupe renommé");
}

export async function deleteGroup(groupId: string) {
  const { q } = await getSession();
  const back = `/famille/groupes/${groupId}`;
  const rows = await attempt(back, () => q("delete from groups where id = $1 returning id", [groupId]));
  if (!rows.length) redirectError(back, "Seuls les administrateurs peuvent supprimer le groupe");
  done("/famille", "Groupe supprimé");
}

/** Nomme ou retire un administrateur du groupe. */
export async function setGroupAdmin(groupId: string, memberId: string, admin: boolean) {
  const { q } = await getSession();
  const back = `/famille/groupes/${groupId}`;
  await attempt(back, () => q("select set_group_admin($1, $2, $3)", [groupId, memberId, admin]));
  done(back, admin ? "Administrateur ajouté" : "Administrateur retiré");
}

/** Qui peut rattacher des événements au groupe : tous les membres ou les administrateurs. */
export async function setEventCreation(groupId: string, fd: FormData) {
  const { q } = await getSession();
  const back = `/famille/groupes/${groupId}`;
  const value = str(fd, "event_creation") === "admins" ? "admins" : "members";
  const rows = await attempt(back, () =>
    q("update groups set event_creation = $2 where id = $1 returning id", [groupId, value]),
  );
  if (!rows.length) redirectError(back, "Réservé aux administrateurs du groupe");
  done(back, "Réglage enregistré");
}

export async function addGroupMember(groupId: string, fd: FormData) {
  const { q } = await getSession();
  const back = `/famille/groupes/${groupId}`;
  await attempt(back, () =>
    q("insert into group_members (group_id, member_id) values ($1, $2)", [groupId, str(fd, "member")]),
  );
  done(back, "Membre ajouté");
}

export async function removeGroupMember(groupId: string, memberId: string) {
  const { q, me } = await getSession();
  const rows = await attempt(`/famille/groupes/${groupId}`, () =>
    q("delete from group_members where group_id = $1 and member_id = $2 returning group_id", [groupId, memberId]),
  );
  if (!rows.length) redirectError(`/famille/groupes/${groupId}`, NOT_ALLOWED);
  if (memberId === me.id) done("/famille", "Tu as quitté le groupe");
  done(`/famille/groupes/${groupId}`, "Membre retiré");
}

// ------------------------------------------------------------- Invitations

export async function createInvitation(fd: FormData) {
  const { tx, me } = await getSession();
  const groups = [...new Set(fd.getAll("groups").map(String).filter(Boolean))];
  await attempt("/famille", () =>
    tx(async (q) => {
      const [inv] = await q<{ token: string }>("insert into invitations (created_by) values ($1) returning token", [me.id]);
      if (groups.length) {
        await q("insert into invitation_groups (token, group_id) select $1, unnest($2::uuid[])", [inv.token, groups]);
      }
    }),
  );
  done("/famille#invitations", "Lien d'invitation créé : copie-le et envoie-le");
}

export async function deleteInvitation(token: string) {
  const { q } = await getSession();
  await q("delete from invitations where token = $1", [token]);
  done("/famille#invitations", "Invitation supprimée");
}

// ------------------------------------------------- Mot de passe oublié

export type ResetLinkState = { link?: string; error?: string };

/** Lien d'activation à envoyer à son enfant pour qu'il se connecte. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function createChildLoginLink(childId: string, _prev: ResetLinkState): Promise<ResetLinkState> {
  const { q } = await getSession();
  try {
    const [row] = await q<{ token: string }>("select create_child_login_link($1) as token", [childId]);
    const h = await headers();
    const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
    return { link: `${origin}/activer/${row.token}` };
  } catch (e) {
    return { error: errorMessage(e) };
  }
}

/** Génère un lien de réinitialisation du mot de passe d'un autre adulte. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function createResetLink(memberId: string, _prev: ResetLinkState): Promise<ResetLinkState> {
  const { q } = await getSession();
  try {
    const [row] = await q<{ token: string }>("select create_password_reset($1) as token", [memberId]);
    const h = await headers();
    const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
    return { link: `${origin}/reinitialiser/${row.token}` };
  } catch (e) {
    return { error: errorMessage(e) };
  }
}
