/**
 * Type-only definitions for the FFJDA agenda (no runtime behavior, erased at compile time):
 * no entry in `scripts/build-core.js`, no `core-dist/` output, no shim.
 */

/** Un événement FFJDA normalisé, sans aucune donnée de contact (agenda FFJDA). */
export interface FfjudoEvent {
  /** "fed:<id>" | "loc:<host>:<id_evenement>" | "nat:<slug>:<YYYY-MM-DD>" */
  eventKey: string;
  titre: string;
  /** YYYY-MM-DD */
  dateDebut: string;
  /** YYYY-MM-DD, "" si absente */
  dateFin: string;
  inscriptionOuverture: string;
  inscriptionCloture: string;
  /** Libellé FFJDA (COMPETITION, PASSAGE DE GRADE…), "" si inconnu */
  typeEvenement: string;
  lieu: string;
  ville: string;
  codePostal: string;
  proprietaire: string;
  sourceUrl: string;
  siteWeb: string;
  /** Hosts où l'événement a été vu. */
  sources: string[];
}
