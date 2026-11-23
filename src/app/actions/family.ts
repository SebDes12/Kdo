"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { loginToEmail } from "@/lib/children";
import { errorMessage } from "@/lib/format";
import { redirectError, redirectOk, safePath } from "@/lib/redirect";

function str(fd: FormData, key: string): string {
  return String(fd.get(key) ?? "").trim();
}

function done(path: string, msg: string): never {
  revalidatePath("/", "layout");
  redirectOk(path, msg);
}

// ---------------------------------------------------------------- Enfants

export async function createChild(fd: FormData) {
  const { supabase } = await getSession();
  const name = str(fd, "name");
  if (!name) redirectError("/famille", "Indique le prénom de l'enfant");
  const { data, error } = await supabase.rpc("create_child", { child_name: name });
  if (error) redirectError("/famille", errorMessage(error));
  revalidatePath("/", "layout");
  redirect(`/famille/enfants/${data}?ok=${encodeURIComponent("Enfant ajouté")}`);
}

/** Crée ou met à jour l'identifiant de connexion d'un enfant (pseudo + mot de passe). */
export async function setChildLogin(childId: string, fd: FormData) {
  const { isParentOf, member } = await getSession();
  const back = `/famille/enfants/${childId}`;
  const child = member(childId);
  if (!child || !isParentOf(childId)) redirectError(back, "Action non autorisée");

  const loginName = (child.login ?? str(fd, "login")).toLowerCase();
  const password = String(fd.get("password") ?? "");
  if (!/^[a-z0-9][a-z0-9._-]{1,30}$/.test(loginName)) {
    redirectError(back, "Pseudo invalide : lettres minuscules, chiffres, . _ - (2 à 31 caractères)");
  }
  if (password.length < 6) redirectError(back, "Le mot de passe doit faire au moins 6 caractères");

  const admin = createAdminClient();
  if (child.user_id) {
    const { error } = await admin.auth.admin.updateUserById(child.user_id, { password });
    if (error) redirectError(back, "Modification impossible");
    done(back, "Mot de passe modifié");
  }

  const { data: taken } = await admin.from("members").select("id").eq("login", loginName).maybeSingle();
  if (taken) redirectError(back, "Ce pseudo est déjà pris");
  const { data, error } = await admin.auth.admin.createUser({
    email: loginToEmail(loginName),
    password,
    email_confirm: true,
    user_metadata: { display_name: child.display_name, child: true },
  });
  if (error || !data.user) redirectError(back, "Création de l'identifiant impossible");
  const { error: upErr } = await admin
    .from("members")
    .update({ user_id: data.user.id, login: loginName })
    .eq("id", childId)
    .is("user_id", null);
  if (upErr) {
    await admin.auth.admin.deleteUser(data.user.id);
    redirectError(back, errorMessage(upErr));
  }
  done(back, "Identifiant créé");
}

export async function renameMember(memberId: string, fd: FormData) {
  const { supabase } = await getSession();
  const back = safePath(fd.get("back"), "/famille");
  const name = str(fd, "name");
  if (!name) redirectError(back, "Le nom ne peut pas être vide");
  const { data, error } = await supabase.from("members").update({ display_name: name }).eq("id", memberId).select("id");
  if (error || !data?.length) redirectError(back, errorMessage(error ?? { message: "Action non autorisée" }));
  done(back, "Nom modifié");
}

export async function addCoparent(childId: string, fd: FormData) {
  const { supabase } = await getSession();
  const back = `/famille/enfants/${childId}`;
  const { error } = await supabase.rpc("add_coparent", { child: childId, parent: str(fd, "parent") });
  if (error) redirectError(back, errorMessage(error));
  done(back, "Parent ajouté");
}

export async function removeCoparent(childId: string, parentId: string) {
  const { supabase } = await getSession();
  const back = `/famille/enfants/${childId}`;
  const { error } = await supabase.rpc("remove_coparent", { child: childId, parent: parentId });
  if (error) redirectError(back, errorMessage(error));
  done(back, "Parent retiré");
}

export async function emancipate(childId: string) {
  const { supabase } = await getSession();
  const { error } = await supabase.rpc("emancipate_child", { child: childId });
  if (error) redirectError(`/famille/enfants/${childId}`, errorMessage(error));
  done("/famille", "Le compte est désormais autonome");
}

// -------------------------------------------------------------- Visibilité

/** Active / désactive le partage de la liste de ownerId avec un groupe ou une personne. */
export async function toggleShare(fd: FormData) {
  const { supabase } = await getSession();
  const back = safePath(fd.get("back"), "/famille");
  const owner = str(fd, "owner");
  const kind = str(fd, "kind") === "group" ? "group_id" : "member_id";
  const target = str(fd, "target");
  const on = str(fd, "on") === "1";
  const { error } = on
    ? await supabase.from("list_shares").insert({ owner_id: owner, [kind]: target })
    : await supabase.from("list_shares").delete().eq("owner_id", owner).eq(kind, target);
  if (error) redirectError(back, errorMessage(error));
  revalidatePath("/", "layout");
  redirect(back);
}

// ----------------------------------------------------------------- Groupes

export async function createGroup(fd: FormData) {
  const { supabase } = await getSession();
  const name = str(fd, "name");
  if (!name) redirectError("/famille", "Indique un nom de groupe");
  const { data, error } = await supabase.rpc("create_group", { group_name: name });
  if (error) redirectError("/famille", errorMessage(error));
  revalidatePath("/", "layout");
  redirect(`/famille/groupes/${data}?ok=${encodeURIComponent("Groupe créé")}`);
}

export async function renameGroup(groupId: string, fd: FormData) {
  const { supabase } = await getSession();
  const back = `/famille/groupes/${groupId}`;
  const { data, error } = await supabase.from("groups").update({ name: str(fd, "name") }).eq("id", groupId).select("id");
  if (error || !data?.length) redirectError(back, errorMessage(error ?? { message: "Seul le créateur peut renommer" }));
  done(back, "Groupe renommé");
}

export async function deleteGroup(groupId: string) {
  const { supabase } = await getSession();
  const { data, error } = await supabase.from("groups").delete().eq("id", groupId).select("id");
  if (error || !data?.length) redirectError(`/famille/groupes/${groupId}`, "Seul le créateur peut supprimer le groupe");
  done("/famille", "Groupe supprimé");
}

export async function addGroupMember(groupId: string, fd: FormData) {
  const { supabase } = await getSession();
  const back = `/famille/groupes/${groupId}`;
  const { error } = await supabase.from("group_members").insert({ group_id: groupId, member_id: str(fd, "member") });
  if (error) redirectError(back, errorMessage(error));
  done(back, "Membre ajouté");
}

export async function removeGroupMember(groupId: string, memberId: string) {
  const { supabase, me } = await getSession();
  const back = memberId === me.id ? "/famille" : `/famille/groupes/${groupId}`;
  const { data, error } = await supabase
    .from("group_members").delete().eq("group_id", groupId).eq("member_id", memberId).select("group_id");
  if (error || !data?.length) redirectError(`/famille/groupes/${groupId}`, "Action non autorisée");
  done(back, memberId === me.id ? "Tu as quitté le groupe" : "Membre retiré");
}

// ------------------------------------------------------------- Invitations

export async function createInvitation(fd: FormData) {
  const { supabase, me } = await getSession();
  const group = str(fd, "group") || null;
  const { error } = await supabase.from("invitations").insert({ created_by: me.id, group_id: group });
  if (error) redirectError("/famille", errorMessage(error));
  done("/famille#invitations", "Lien d'invitation créé : copie-le et envoie-le");
}

export async function deleteInvitation(token: string) {
  const { supabase } = await getSession();
  await supabase.from("invitations").delete().eq("token", token);
  done("/famille#invitations", "Invitation supprimée");
}
