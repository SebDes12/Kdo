"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { errorMessage } from "@/lib/format";
import { redirectError, redirectOk } from "@/lib/redirect";

function readEvent(fd: FormData, back: string) {
  const name = String(fd.get("name") ?? "").trim();
  const date = String(fd.get("date") ?? "");
  const beneficiaries = [...new Set(fd.getAll("beneficiaries").map(String))];
  if (!name) redirectError(back, "Donne un nom à l'événement");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) redirectError(back, "Choisis une date");
  if (!beneficiaries.length) redirectError(back, "Choisis au moins une personne qui reçoit des cadeaux");
  return { name, date, beneficiaries };
}

export async function createEvent(fd: FormData) {
  const { supabase, me } = await getSession();
  const back = "/evenements/nouveau";
  const ev = readEvent(fd, back);
  const { data, error } = await supabase
    .from("events")
    .insert({ name: ev.name, event_date: ev.date, created_by: me.id })
    .select("id")
    .single();
  if (error || !data) redirectError(back, errorMessage(error));
  const { error: bErr } = await supabase
    .from("event_beneficiaries")
    .insert(ev.beneficiaries.map((m) => ({ event_id: data.id, member_id: m })));
  if (bErr) redirectError(back, errorMessage(bErr));
  revalidatePath("/", "layout");
  redirect(`/evenements/${data.id}`);
}

export async function updateEvent(eventId: string, fd: FormData) {
  const { supabase } = await getSession();
  const back = `/evenements/${eventId}/modifier`;
  const ev = readEvent(fd, back);
  const { data, error } = await supabase
    .from("events").update({ name: ev.name, event_date: ev.date }).eq("id", eventId).select("id");
  if (error || !data?.length) redirectError(back, errorMessage(error ?? { message: "Seul le créateur peut modifier" }));

  const { data: current } = await supabase.from("event_beneficiaries").select("member_id").eq("event_id", eventId);
  const before = new Set((current ?? []).map((b) => b.member_id as string));
  const toAdd = ev.beneficiaries.filter((m) => !before.has(m));
  const toRemove = [...before].filter((m) => !ev.beneficiaries.includes(m));
  if (toAdd.length) {
    await supabase.from("event_beneficiaries").insert(toAdd.map((m) => ({ event_id: eventId, member_id: m })));
  }
  if (toRemove.length) {
    await supabase.from("event_beneficiaries").delete().eq("event_id", eventId).in("member_id", toRemove);
  }
  revalidatePath("/", "layout");
  redirectOk(`/evenements/${eventId}`, "Événement modifié");
}

export async function deleteEvent(eventId: string) {
  const { supabase } = await getSession();
  const { data, error } = await supabase.from("events").delete().eq("id", eventId).select("id");
  if (error || !data?.length) redirectError(`/evenements/${eventId}/modifier`, "Seul le créateur peut supprimer");
  revalidatePath("/", "layout");
  redirectOk("/", "Événement supprimé");
}
