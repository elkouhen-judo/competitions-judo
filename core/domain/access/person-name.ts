export interface PersonName {
  firstName: string;
  lastName: string;
  displayName(): string;
}

export interface PersonNameInput {
  firstName?: unknown;
  lastName?: unknown;
}

function cleanNamePart(value: unknown): string {
  return String(value || "").trim();
}

export function createPersonName({ firstName, lastName }: PersonNameInput = {}): PersonName {
  const normalizedFirstName = cleanNamePart(firstName);
  const normalizedLastName = cleanNamePart(lastName);

  if (!normalizedFirstName || !normalizedLastName) {
    throw new Error("Prénom et nom de l'enfant obligatoires.");
  }

  return {
    firstName: normalizedFirstName,
    lastName: normalizedLastName,
    displayName() {
      return [normalizedFirstName, normalizedLastName].filter(Boolean).join(" ");
    }
  };
}

export function createOptionalPersonName({
  firstName,
  lastName
}: PersonNameInput = {}): PersonName {
  const normalizedFirstName = cleanNamePart(firstName);
  const normalizedLastName = cleanNamePart(lastName);

  return {
    firstName: normalizedFirstName,
    lastName: normalizedLastName,
    displayName() {
      return [normalizedFirstName, normalizedLastName].filter(Boolean).join(" ");
    }
  };
}
