"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { attempt, redirectError, redirectOk } from "@/lib/redirect";
import { getSession } from "@/lib/session";

function readEvent(fd: FormData, back: string) {
  const name = String(fd.get("name") ?? "").trim();
  const date = String(fd.get("date") ?? "");
  const end = String(fd.get("end") ?? "") || date;
  const groups = [...new Set(fd.getAll("groups").map(String))];
  if (!name) redirectError(back, "Donne un nom à l'événement");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) redirectError(back, "Choisis une date");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(end) || end < date) redirectError(back, "La date de fin doit être après le début");
  if (!groups.length) redirectError(back, "Choisis au moins un groupe");
  return { name, date, end, groups };
}

export async function createEvent(fd: FormData) {
  const { tx, me } = await getSession();
  const back = "/evenements/nouveau";
  const ev = readEvent(fd, back);
  const id = await attempt(back, () =>
    tx(async (q) => {
      const [row] = await q<{ id: string }>(
        "insert into events (name, event_date, end_date, created_by) values ($1, $2, $3, $4) returning id",
        [ev.name, ev.date, ev.end, me.id],
      );
      await q("insert into event_groups (event_id, group_id) select $1, unnest($2::uuid[])", [row.id, ev.groups]);
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
      const rows = await q(
        "update events set name = $2, event_date = $3, end_date = $4 where id = $1 returning id",
        [eventId, ev.name, ev.date, ev.end],
      );
      if (!rows.length) return false;
      await q("delete from event_groups where event_id = $1 and not (group_id = any($2::uuid[]))", [eventId, ev.groups]);
      await q(
        "insert into event_groups (event_id, group_id) select $1, unnest($2::uuid[]) on conflict do nothing",
        [eventId, ev.groups],
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
