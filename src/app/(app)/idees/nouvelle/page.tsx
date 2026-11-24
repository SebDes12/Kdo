import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { getSession } from "@/lib/session";
import { safePath } from "@/lib/redirect";
import { IdeaForm } from "../idea-form";
import { upcomingEventsFor } from "../load";

export const metadata: Metadata = { title: "Nouvelle idée" };

export default async function NewIdeaPage({ searchParams }: PageProps<"/idees/nouvelle">) {
  const sp = await searchParams;
  const session = await getSession();
  const { me, member, isParentOf, q } = session;
  const pourId = typeof sp.pour === "string" ? sp.pour : me.id;
  const beneficiary = member(pourId);
  if (!beneficiary) notFound();
  if (beneficiary.id !== me.id && !isParentOf(beneficiary.id)) {
    const [{ ok }] = await q<{ ok: boolean }>("select can_view_list($1) as ok", [beneficiary.id]);
    if (!ok) notFound();
  }
  const back = safePath(sp.back as string | undefined, `/listes/${me.id}`);
  const events = await upcomingEventsFor(session, beneficiary.id);
  const defaultEvent = typeof sp.evenement === "string" ? sp.evenement : events[0]?.id;
  const formPath = `/idees/nouvelle?pour=${beneficiary.id}&evenement=${defaultEvent ?? ""}&back=${encodeURIComponent(back)}`;

  return (
    <>
      <PageHeader
        back={{ href: back, label: "Retour" }}
        title={beneficiary.id === me.id ? "Nouvelle idée" : `Idée pour ${beneficiary.display_name}`}
      />
      <IdeaForm
        beneficiary={beneficiary}
        me={me}
        isParent={isParentOf(beneficiary.id)}
        events={events}
        defaultEvent={defaultEvent}
        back={back}
        formPath={formPath}
      />
    </>
  );
}
