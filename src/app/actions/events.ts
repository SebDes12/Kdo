"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { attempt, redirectError, redirectOk } from "@/lib/redirect";
import { getSession } from "@/lib/session";

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
  const { tx, me } = await getSession();
  const back = "/evenements/nouveau";
  const ev = readEvent(fd, back);
  const id = await attempt(back, () =>
    tx(async (q) => {
      const [row] = await q<{ id: string }>(
        "insert into events (name, event_date, created_by) values ($1, $2, $3) returning id",
        [ev.name, ev.date, me.id],
      );
      await q(
        "insert into event_beneficiaries (event_id, member_id) select $1, unnest($2::uuid[])",
        [row.id, ev.beneficiaries],
      );
      return row.id;
    }),
  );
  revalidatePath("/", "layout");
  redirect(`/evenements/${id}`);
}

export async function updateEvent(eventId: string, fd: FormData) {
  const { tx } = await getSession();
  const back = `/evenements/${eventId}/modifier`;
  const ev = readEvent(fd, back);
  const updated = await attempt(back, () =>
    tx(async (q) => {
      const rows = await q("update events set name = $2, event_date = $3 where id = $1 returning id", [
        eventId,
        ev.name,
        ev.date,
      ]);
      if (!rows.length) return false;
      await q("delete from event_beneficiaries where event_id = $1 and not (member_id = any($2::uuid[]))", [
        eventId,
        ev.beneficiaries,
      ]);
      await q(
        `insert into event_beneficiaries (event_id, member_id)
         select $1, unnest($2::uuid[]) on conflict do nothing`,
        [eventId, ev.beneficiaries],
      );
      return true;
    }),
  );
  if (!updated) redirectError(back, "Seul le créateur peut modifier");
  revalidatePath("/", "layout");
  redirectOk(`/evenements/${eventId}`, "Événement modifié");
}

export async function deleteEvent(eventId: string) {
  const { q } = await getSession();
  const back = `/evenements/${eventId}/modifier`;
  const rows = await attempt(back, () => q("delete from events where id = $1 returning id", [eventId]));
  if (!rows.length) redirectError(back, "Seul le créateur peut supprimer");
  revalidatePath("/", "layout");
  redirectOk("/", "Événement supprimé");
}
