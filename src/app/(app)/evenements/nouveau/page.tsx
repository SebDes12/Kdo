import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createEvent } from "@/app/actions/events";
import { PageHeader } from "@/components/ui";
import { getSession } from "@/lib/session";
import { EventForm } from "../event-form";
import { myGroups } from "../load";

export const metadata: Metadata = { title: "Nouvel événement" };

export default async function NewEventPage() {
  const session = await getSession();
  if (session.me.is_child) redirect("/");
  const groups = await myGroups(session);
  return (
    <>
      <PageHeader back={{ href: "/", label: "Accueil" }} title="Nouvel événement" />
      <EventForm action={createEvent} groups={groups} submitLabel="Créer l'événement" />
    </>
  );
}
