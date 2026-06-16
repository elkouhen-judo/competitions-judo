/**
 * Type-only definitions for the `core/repositories/**` layer (no runtime
 * behavior, erased at compile time): no entry in `scripts/build-core.js`,
 * no `core-dist/` output, no shim.
 */

export interface SupabaseRestDeps {
  supabaseSelect: <T = Record<string, unknown>>(table: string, query?: string) => Promise<T[]>;
  supabaseSelectOne: <T = Record<string, unknown>>(
    table: string,
    query?: string
  ) => Promise<T | null>;
  supabaseInsert: <T = Record<string, unknown>>(table: string, payload: unknown) => Promise<T | null>;
  supabasePatch: <T = Record<string, unknown>>(
    table: string,
    query: string,
    payload: unknown
  ) => Promise<T | null>;
  supabaseDelete: (table: string, query: string) => Promise<void>;
  eqFilter: (column: string, value: unknown) => string;
}

export interface JudokaRow {
  id_judoka: string;
  email: string;
  prenom: string;
  nom: string;
  profile_type: string;
  role: string;
  notes_coach?: string;
  categorie_age?: string;
  categorie_poids?: string;
  couleur_ceinture?: string;
}

export interface CompetitionRow {
  id_competition: string;
  id_judoka: string;
  club_competition_id: string | null;
  nom: string;
  date: string;
  categorie_age: string;
  categorie_poids: string;
  niveau: string;
  classement: string;
  coach_objective: string;
  coach_review: string;
}

export interface CombatRow {
  id_combat: string;
  id_judoka: string;
  id_competition: string;
  adversaire: string;
  resultat: string;
  type_victoire: string;
  deroule: string;
}

export interface ClubCompetitionRow {
  id_club_competition: string;
  nom: string;
  date: string;
  categorie_age: string;
  categorie_poids: string;
}

export interface AccessInvitationRow {
  email: string;
  invited_profile_type: string;
  invited_by: string;
  created_at: string;
  updated_at: string;
}

export interface ParentLinkRow {
  id_parent: string;
  id_judoka: string;
}
