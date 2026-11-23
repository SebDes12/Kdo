import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createEvent } from "@/app/actions/events";
import { PageHeader } from "@/components/ui";
import { getSession } from "@/lib/session";
import { EventForm } from "../event-form";

export const metadata: Metadata = { title: "Nouvel événement" };

export default async function NewEventPage() {
  const { me, members } = await getSession();
  if (me.is_child) redirect("/");
  return (
    <>
      <PageHeader back={{ href: "/", label: "Accueil" }} title="Nouvel événement" />
      <EventForm action={createEvent} members={members} submitLabel="Créer l'événement" />
    </>
  );
}
