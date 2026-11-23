"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { loginToEmail } from "@/lib/children";
import { redirectError, redirectOk } from "@/lib/redirect";

function str(fd: FormData, key: string): string {
  return String(fd.get(key) ?? "").trim();
}

export async function login(fd: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: loginToEmail(str(fd, "identifiant")),
    password: String(fd.get("password") ?? ""),
  });
  if (error) redirectError("/connexion", "Identifiant ou mot de passe incorrect");
  redirect("/");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
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

/** Crée l'utilisateur Supabase + le membre, puis ouvre la session. */
async function createAccountAndSignIn(acc: NewAccount, back: string): Promise<string> {
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email: acc.email,
    password: acc.password,
    email_confirm: true,
    user_metadata: { display_name: acc.name },
  });
  if (error || !data.user) {
    redirectError(back, error?.message?.includes("already") ? "Un compte existe déjà avec cet e-mail" : "Création du compte impossible");
  }
  const { data: member, error: mErr } = await admin
    .from("members")
    .insert({ user_id: data.user.id, display_name: acc.name })
    .select("id")
    .single();
  if (mErr || !member) {
    await admin.auth.admin.deleteUser(data.user.id);
    redirectError(back, "Création du profil impossible");
  }
  const supabase = await createClient();
  await supabase.auth.signInWithPassword({ email: acc.email, password: acc.password });
  return member.id;
}

/** Premier compte de la famille : possible uniquement si la base est vide. */
export async function bootstrap(fd: FormData) {
  const back = "/bienvenue";
  const acc = readAccount(fd, back);
  const admin = createAdminClient();
  const { count } = await admin.from("members").select("id", { count: "exact", head: true });
  if ((count ?? 0) > 0) redirectError("/connexion", "La famille existe déjà : demande une invitation");
  await createAccountAndSignIn(acc, back);
  redirect("/famille?bienvenue=1");
}

export async function acceptInvitation(token: string, fd: FormData) {
  const back = `/invitation/${encodeURIComponent(token)}`;
  const acc = readAccount(fd, back);
  const admin = createAdminClient();
  const { data: inv } = await admin
    .from("invitations")
    .select("token, group_id, used_at, expires_at")
    .eq("token", token)
    .maybeSingle();
  if (!inv || inv.used_at || new Date(inv.expires_at) < new Date()) {
    redirectError(back, "Cette invitation n'est plus valable");
  }
  // On réserve l'invitation avant de créer le compte (usage unique).
  const { data: claimed } = await admin
    .from("invitations")
    .update({ used_at: new Date().toISOString() })
    .eq("token", token)
    .is("used_at", null)
    .select("token");
  if (!claimed?.length) redirectError(back, "Cette invitation n'est plus valable");

  let memberId: string;
  try {
    memberId = await createAccountAndSignIn(acc, back);
  } catch (e) {
    await admin.from("invitations").update({ used_at: null }).eq("token", token);
    throw e;
  }
  await admin.from("invitations").update({ used_by: memberId }).eq("token", token);
  if (inv.group_id) {
    await admin.from("group_members").insert({ group_id: inv.group_id, member_id: memberId });
  }
  redirect("/?bienvenue=1");
}

export async function requestPasswordReset(fd: FormData) {
  const email = str(fd, "email").toLowerCase();
  const h = await headers();
  const origin = h.get("origin") ?? `https://${h.get("host")}`;
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/confirm?next=/compte%23mot-de-passe`,
  });
  redirectOk("/mot-de-passe-oublie", "Si un compte existe, un e-mail vient d'être envoyé");
}

export async function updatePassword(fd: FormData) {
  const password = String(fd.get("password") ?? "");
  if (password.length < 8) redirectError("/compte", "Le mot de passe doit faire au moins 8 caractères");
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) redirectError("/compte", "Changement impossible : " + error.message);
  redirectOk("/compte", "Mot de passe modifié");
}
