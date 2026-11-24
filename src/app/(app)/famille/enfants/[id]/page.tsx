import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { addCoparent, createChildLoginLink, deleteChild, emancipate, removeCoparent, renameMember, setChildLogin } from "@/app/actions/family";
import { ConfirmButton, LinkButton, SubmitButton } from "@/components/client";
import { Avatar, PageHeader, Section } from "@/components/ui";
import { getSession } from "@/lib/session";
import { loadGroups } from "../../load";
import { GroupToggles } from "../../group-toggles";

export const metadata: Metadata = { title: "Enfant" };

export default async function ChildPage({ params }: PageProps<"/famille/enfants/[id]">) {
  const { id } = await params;
  const session = await getSession();
  const { me, members, parentLinks, member, isParentOf } = session;
  const child = member(id);
  if (!child || !isParentOf(id)) notFound();
  const { groups, groupMembers } = await loadGroups(session);
  // Je ne peux gérer que les groupes dont je fais partie
  const myGroups = groups.filter((g) => groupMembers.some((gm) => gm.group_id === g.id && gm.member_id === me.id));

  const back = `/famille/enfants/${id}`;
  const parents = parentLinks.filter((l) => l.child_id === id).map((l) => member(l.parent_id)!).filter(Boolean);
  const adults = members.filter((m) => !m.is_child && !parents.some((p) => p.id === m.id));

  return (
    <>
      <PageHeader
        back={{ href: "/famille", label: "Famille" }}
        title={<span className="flex items-center gap-3"><Avatar member={child} size="lg" /> {child.display_name}</span>}
        action={<Link href={`/listes/${id}`} className="btn-primary shrink-0">Sa liste</Link>}
      />

      <Section title="Prénom">
        <form action={renameMember.bind(null, id)} className="card flex gap-2 p-4">
          <input type="hidden" name="back" value={back} />
          <input name="name" className="field" defaultValue={child.display_name} required maxLength={60} aria-label="Prénom" />
          <SubmitButton className="btn-secondary shrink-0">Enregistrer</SubmitButton>
        </form>
      </Section>

      <Section
        title="Connexion"
        id="connexion"
        description="Facultatif : pour que l'enfant écrive sa liste lui-même."
      >
        <div className="card mb-3 p-4">
          <p className="mb-2 text-sm">
            <strong>Le plus simple :</strong> envoie-lui un lien. En l&apos;ouvrant, {child.display_name} choisit son mot de
            passe{child.login ? "" : " (et son pseudo)"} et se retrouve connecté.
          </p>
          <LinkButton
            label={`🔗 Envoyer un lien de connexion à ${child.display_name}`}
            className="btn-primary"
            title={`Lien de connexion pour ${child.display_name}`}
            message="Le lien sert une seule fois et reste valable 7 jours. Un nouveau lien annule le précédent."
            confirmLabel="Créer le lien"
            shareText={`Envoie ce lien à ${child.display_name} (WhatsApp, SMS…) :`}
            action={createChildLoginLink.bind(null, id)}
          />
        </div>
        <p className="mb-2 text-sm text-muted">Ou crée-lui toi-même son identifiant :</p>
        <form action={setChildLogin.bind(null, id)} className="card grid gap-3 p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <div>
            <label className="label" htmlFor="login">Pseudo</label>
            <input id="login" name="login" className="field" defaultValue={child.login ?? ""} disabled={!!child.login}
              placeholder="ex. leo" pattern="[a-z0-9][a-z0-9._\-]{1,30}" autoCapitalize="none" required={!child.login} />
          </div>
          <div>
            <label className="label" htmlFor="password">{child.login ? "Nouveau mot de passe" : "Mot de passe"}</label>
            <input id="password" name="password" type="text" className="field" minLength={6} required autoComplete="off" />
          </div>
          <SubmitButton className="btn-secondary">{child.login ? "Changer" : "Créer"}</SubmitButton>
        </form>
      </Section>

      <Section
        title={`Groupes de ${child.display_name}`}
        id="groupes"
        description={`${child.display_name} voit les événements de ces groupes et peut y ajouter sa liste, visible par leurs membres.`}
      >
        <GroupToggles member={child} groups={myGroups} groupMembers={groupMembers} back={back + "#groupes"} />
      </Section>

      <Section title="Parents" description="Les parents gèrent la liste et les réglages de l'enfant.">
        <ul className="card mb-3 divide-y divide-line">
          {parents.map((p) => (
            <li key={p.id} className="flex items-center gap-3 px-4 py-3">
              <Avatar member={p} size="sm" />
              <span className="flex-1 font-bold">{p.display_name}{p.id === me.id && " (moi)"}</span>
              {parents.length > 1 && (
                <form action={removeCoparent.bind(null, id, p.id)}>
                  <ConfirmButton
                    title={`Retirer ${p.display_name} des parents ?`}
                    message="Il ne pourra plus gérer la liste ni les réglages de l'enfant."
                    confirmLabel="Retirer"
                    className="btn-ghost py-1 text-xs"
                  >
                    Retirer
                  </ConfirmButton>
                </form>
              )}
            </li>
          ))}
        </ul>
        {adults.length > 0 && (
          <form action={addCoparent.bind(null, id)} className="flex gap-2">
            <select name="parent" className="field" required aria-label="Ajouter un parent">
              {adults.map((a) => <option key={a.id} value={a.id}>{a.display_name}</option>)}
            </select>
            <SubmitButton className="btn-secondary shrink-0">+ Ajouter</SubmitButton>
          </form>
        )}
      </Section>

      <Section title="Émanciper" description={`${child.display_name} devient autonome : il gère seul sa liste et sa visibilité. Les parents perdent l'accès aux réglages.`}>
        {child.login ? (
          <form action={emancipate.bind(null, id)}>
            <ConfirmButton
              title={`Rendre ${child.display_name} autonome ?`}
              message="C'est définitif : les parents ne pourront plus gérer sa liste ni ses réglages."
              confirmLabel="Rendre autonome"
            >
              Rendre le compte autonome
            </ConfirmButton>
          </form>
        ) : (
          <p className="text-sm text-muted">Crée d&apos;abord un identifiant de connexion.</p>
        )}
      </Section>

      <Section
        title={`Supprimer ${child.display_name}`}
        description="Par exemple s'il a été ajouté deux fois. Ses idées, ses choix et son identifiant disparaissent aussi."
      >
        <form action={deleteChild.bind(null, id)}>
          <ConfirmButton
            title={`Supprimer ${child.display_name} ?`}
            message="Ses idées, ses choix et son identifiant de connexion seront supprimés définitivement."
            confirmLabel="Supprimer"
          >
            🗑 Supprimer {child.display_name}
          </ConfirmButton>
        </form>
      </Section>
    </>
  );
}
