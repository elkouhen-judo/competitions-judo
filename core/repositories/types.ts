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
  /** Lit une page et le nombre total de lignes qui répondent au filtre. */
  supabaseSelectPage: <T = Record<string, unknown>>(
    table: string,
    query: string,
    limit: number
  ) => Promise<{ rows: T[]; total: number }>;
  supabaseInsert: <T = Record<string, unknown>>(table: string, payload: unknown) => Promise<T | null>;
  /** Insère plusieurs lignes en un seul envoi. */
  supabaseInsertMany: <T = Record<string, unknown>>(table: string, payloads: unknown[]) => Promise<T[]>;
  supabasePatch: <T = Record<string, unknown>>(
    table: string,
    query: string,
    payload: unknown
  ) => Promise<T | null>;
  supabaseDelete: (table: string, query: string) => Promise<void>;
  eqFilter: (column: string, value: unknown) => string;
  /** Appelle une fonction SQL (rôle service) ; absent des dépôts qui n'en ont pas besoin. */
  supabaseRpc?: <T = unknown>(
    functionName: string,
    payload?: Record<string, unknown>,
    options?: { readOnly?: boolean }
  ) => Promise<T>;
}

export interface JudokaRow {
  id_judoka: string;
  email: string;
  prenom: string;
  nom: string;
  profile_type: string;
  role: string;
  categorie_age?: string;
  categorie_poids?: string;
  couleur_ceinture?: string;
  genre?: string;
  annee_categorie?: string;
  lateralite?: string;
  pending_parent_email?: string | null;
  club_id?: string | null;
  is_admin?: boolean;
}

/** Un compte avec ses liens : clubs coachés et enfants rattachés (CTX-1, une seule requête). */
export interface JudokaIdentity {
  user: JudokaRow;
  coachClubIds: string[];
  childJudokaIds: string[];
}

export interface ClubRow {
  id_club: string;
  nom: string;
}

export interface CoachClubRow {
  id_coach: string;
  id_club: string;
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
  coach_review: string;
  ai_analysis: string;
}

export interface CombatRow {
  id_combat: string;
  id_judoka: string;
  id_competition: string;
  adversaire: string;
  garde_adversaire?: string;
  etape?: string;
  resultat: string;
  type_victoire: string;
  deroule: string;
  score_judoka_ippon?: number | null;
  score_judoka_wazaari?: number | null;
  score_judoka_yuko?: number | null;
  score_adversaire_ippon?: number | null;
  score_adversaire_wazaari?: number | null;
  score_adversaire_yuko?: number | null;
  score_judoka_shido?: number | null;
  score_adversaire_shido?: number | null;
}

/** Compétition lue avec le résultat de ses combats, pour le bilan V/D de l'accueil. */
export type CompetitionWithResultsRow = CompetitionRow & { combats: Pick<CombatRow, "resultat">[] };

/** Combat lu avec ses points (marqués et subis) en une requête. */
export type CombatWithScoresRow = CombatRow & { combat_scores: CombatScoreRow[] };

export interface CombatScoreRow {
  id_combat_score: string;
  id_combat: string;
  categorie: string;
  technique: string;
  type_ne_waza: string;
  valeur: string;
  ordre: number;
  /** JUDOKA : point marqué ; ADVERSAIRE : point subi. Absent sur les anciennes lignes. */
  camp?: string;
}

export interface ClubCompetitionRow {
  id_club_competition: string;
  nom: string;
  date: string;
  categorie_age: string;
  niveau: string;
  club_id?: string | null;
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
