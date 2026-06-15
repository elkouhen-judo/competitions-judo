function createRequiredId(value: unknown, message: string): string {
  const id = String(value || "").trim();
  if (!id) {
    throw new Error(message);
  }
  return id;
}

function createOptionalId(value: unknown): string | null {
  const id = String(value || "").trim();
  return id || null;
}

export function createJudokaId(value: unknown, message = "Judoka obligatoire."): string {
  return createRequiredId(value, message);
}

export function createOptionalJudokaId(value: unknown): string | null {
  return createOptionalId(value);
}

export function createCompetitionId(value: unknown, message = "Compétition obligatoire."): string {
  return createRequiredId(value, message);
}

export function createOptionalCompetitionId(value: unknown): string | null {
  return createOptionalId(value);
}

export function createCombatId(value: unknown, message = "Combat obligatoire."): string {
  return createRequiredId(value, message);
}
