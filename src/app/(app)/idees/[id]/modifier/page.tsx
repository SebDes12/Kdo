import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { getSession } from "@/lib/session";
import { safePath } from "@/lib/redirect";
import { IDEAS_SQL } from "@/lib/ideas";
import { isUuid } from "@/lib/format";
import type { Idea } from "@/lib/types";
import { IdeaForm } from "../../idea-form";
import { upcomingEventsFor } from "../../load";

export const metadata: Metadata = { title: "Modifier l'idée" };

export default async function EditIdeaPage({ params, searchParams }: PageProps<"/idees/[id]/modifier">) {
  const { id } = await params;
  const sp = await searchParams;
  const session = await getSession();
  const { q, me, member, isParentOf } = session;
  if (!isUuid(id)) notFound();
  const [idea] = await q<Idea & { can_edit: boolean }>(`select x.*, can_edit_idea(x.id) as can_edit from (${IDEAS_SQL} where i.id = $1) x`, [id]);
  if (!idea) notFound();
  const canEdit = idea.can_edit;
  const beneficiary = member(idea.beneficiary_id);
  if (!canEdit || !beneficiary) notFound();

  const back = safePath(sp.back as string | undefined, `/listes/${idea.beneficiary_id}`);
  const events = await upcomingEventsFor(session, beneficiary.id);

  return (
    <>
      <PageHeader back={{ href: back, label: "Retour" }} title="Modifier l'idée" />
      <IdeaForm
        beneficiary={beneficiary}
        me={me}
        isParent={isParentOf(beneficiary.id)}
        events={events}
        idea={idea}
        back={back}
        formPath={`/idees/${id}/modifier?back=${encodeURIComponent(back)}`}
      />
    </>
  );
}
