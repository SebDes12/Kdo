import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { deleteEvent, updateEvent } from "@/app/actions/events";
import { ConfirmButton } from "@/components/client";
import { PageHeader } from "@/components/ui";
import { getSession } from "@/lib/session";
import type { EventRow } from "@/lib/types";
import { EventForm } from "../../event-form";

export const metadata: Metadata = { title: "Modifier l'événement" };

export default async function EditEventPage({ params }: PageProps<"/evenements/[id]/modifier">) {
  const { id } = await params;
  const { supabase, me, members } = await getSession();
  const { data } = await supabase
    .from("events")
    .select("id, name, event_date, created_by, event_beneficiaries(member_id)")
    .eq("id", id)
    .maybeSingle();
  const ev = data as EventRow | null;
  if (!ev || ev.created_by !== me.id) notFound();

  return (
    <>
      <PageHeader back={{ href: `/evenements/${id}`, label: ev.name }} title="Modifier l'événement" />
      <EventForm
        action={updateEvent.bind(null, id)}
        members={members}
        initial={{ name: ev.name, date: ev.event_date, beneficiaries: (ev.event_beneficiaries ?? []).map((b) => b.member_id) }}
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
