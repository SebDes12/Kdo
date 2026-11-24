import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { deleteEvent, updateEvent } from "@/app/actions/events";
import { ConfirmButton } from "@/components/client";
import { PageHeader } from "@/components/ui";
import { getSession } from "@/lib/session";
import { EVENTS_SQL } from "@/lib/ideas";
import type { EventRow } from "@/lib/types";
import { isUuid } from "@/lib/format";
import { EventForm } from "../../event-form";
import { myGroups } from "../../load";

export const metadata: Metadata = { title: "Modifier l'événement" };

export default async function EditEventPage({ params }: PageProps<"/evenements/[id]/modifier">) {
  const { id } = await params;
  const session = await getSession();
  const { q, me } = session;
  const [ev] = isUuid(id) ? await q<EventRow>(`${EVENTS_SQL} where e.id = $1`, [id]) : [];
  if (!ev || ev.created_by !== me.id) notFound();

  return (
    <>
      <PageHeader back={{ href: `/evenements/${id}`, label: ev.name }} title="Modifier l'événement" />
      <EventForm
        action={updateEvent.bind(null, id)}
        groups={await myGroups(session)}
        initial={{ name: ev.name, date: ev.event_date, groups: (ev.event_groups ?? []).map((g) => g.group_id) }}
        submitLabel="Enregistrer"
      />
      <form action={deleteEvent.bind(null, id)} className="mt-8 border-t border-line pt-6">
        <ConfirmButton message="Supprimer cet événement ? Les idées seront conservées (en réserve), les choix seront perdus.">
          Supprimer l&apos;événement
        </ConfirmButton>
      </form>
    </>
  );
}
