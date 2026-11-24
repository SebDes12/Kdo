export type Member = {
  id: string;
  display_name: string;
  is_child: boolean;
  /** Pseudo de connexion d'un enfant (null si pas d'identifiant). */
  login: string | null;
};

export type ParentLink = { parent_id: string; child_id: string };

export type EventRow = {
  id: string;
  name: string;
  /** Début de la période. */
  event_date: string;
  /** Fin de la période (égale au début pour un seul jour). */
  end_date: string;
  created_by: string | null;
  /** Groupes rattachés à l'événement. */
  event_groups?: { group_id: string }[];
};

export type IdeaLink = { id: string; url: string; position: number };

export type Idea = {
  id: string;
  beneficiary_id: string;
  event_id: string | null;
  title: string;
  description: string | null;
  price_cents: number | null;
  priority: number;
  image_url: string | null;
  is_secret: boolean;
  created_by: string | null;
  created_at: string;
  /** Suppression logique (visible seulement de ceux qui l'avaient choisie). */
  deleted_at: string | null;
  deleted_by: string | null;
  idea_links: IdeaLink[];
};

export type Contribution = {
  idea_id: string;
  event_id: string;
  member_id: string;
  percent: number;
};

export type Group = { id: string; name: string; created_by: string | null };
export type GroupMember = { group_id: string; member_id: string };
