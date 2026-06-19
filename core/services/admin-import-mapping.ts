import type { JudokaRow } from "../repositories/types";
import type { AccessRole } from "../domain/access/role";

export interface ImportProfileOptions {
  accessRole?: AccessRole;
  ageCategory?: string;
  beltColor?: string;
  gender?: string;
  yearInCategory?: string;
  handedness?: string;
}

export interface ImportProfileUpdates {
  accessRole?: AccessRole;
  ageCategory?: string;
  beltColor?: string;
  gender?: string;
  yearInCategory?: string;
  handedness?: string;
}

export function buildChangedImportProfileUpdates(
  existing: JudokaRow,
  options: ImportProfileOptions
): ImportProfileUpdates {
  return {
    ...(options.accessRole && options.accessRole !== existing.role ? { accessRole: options.accessRole } : {}),
    ...(options.ageCategory && options.ageCategory !== existing.categorie_age ? { ageCategory: options.ageCategory } : {}),
    ...(options.beltColor && options.beltColor !== existing.couleur_ceinture ? { beltColor: options.beltColor } : {}),
    ...(options.gender && options.gender !== existing.genre ? { gender: options.gender } : {}),
    ...(options.yearInCategory && options.yearInCategory !== existing.annee_categorie
      ? { yearInCategory: options.yearInCategory }
      : {}),
    ...(options.handedness && options.handedness !== existing.lateralite ? { handedness: options.handedness } : {})
  };
}

export function hasImportProfileUpdates(updates: ImportProfileUpdates): boolean {
  return Object.keys(updates).length > 0;
}

export function toJudokaRepositoryExtras(options: ImportProfileOptions): Record<string, string> {
  return {
    ...(options.ageCategory ? { categorie_age: options.ageCategory } : {}),
    ...(options.beltColor ? { couleur_ceinture: options.beltColor } : {}),
    ...(options.gender ? { genre: options.gender } : {}),
    ...(options.yearInCategory ? { annee_categorie: options.yearInCategory } : {}),
    ...(options.handedness ? { lateralite: options.handedness } : {})
  };
}

export function applyImportProfileUpdatesToRow(
  existing: JudokaRow,
  updates: ImportProfileUpdates
): JudokaRow {
  return {
    ...existing,
    ...(updates.accessRole ? { role: updates.accessRole } : {}),
    ...(updates.ageCategory ? { categorie_age: updates.ageCategory } : {}),
    ...(updates.beltColor ? { couleur_ceinture: updates.beltColor } : {}),
    ...(updates.gender ? { genre: updates.gender } : {}),
    ...(updates.yearInCategory ? { annee_categorie: updates.yearInCategory } : {}),
    ...(updates.handedness ? { lateralite: updates.handedness } : {})
  };
}
