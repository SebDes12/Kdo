import type { ThemeId } from "@/lib/themes";

export type Member = {
  id: string;
  display_name: string;
  is_child: boolean;
  /** Pseudo de connexion d'un enfant (null si pas d'identifiant). */
  login: string | null;
  /** Thème d'affichage choisi (null = thème par défaut). */
  theme: ThemeId | null;
  /** Thème à retrouver après les fêtes (Noël activé depuis la proposition). */
  theme_restore: ThemeId | null;
  /** Visite guidée déjà vue (ou passée). */
  tour_done: boolean;
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
  updated_at?: string | null;
  updated_by?: string | null;
  /** Dans la corbeille depuis… (restaurable 30 jours). */
  deleted_at?: string | null;
  deleted_by?: string | null;
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
  /** Photo envoyée dans Kdo (version pour le cache), ou null. */
  image_version: string | null;
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

export type Group = { id: string; name: string; created_by: string | null; event_creation?: "members" | "admins" };
export type GroupMember = { group_id: string; member_id: string; is_admin?: boolean };
