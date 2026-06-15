export type ProfileType = "JUDOKA" | "PARENT";

export function normalizeProfileType(value: unknown): string {
  return (
    String(value || "")
      .toUpperCase()
      .trim() || "JUDOKA"
  );
}

export function createProfileType(value: unknown): ProfileType {
  const profileType = normalizeProfileType(value);
  if (profileType !== "JUDOKA" && profileType !== "PARENT") {
    throw new Error("Type de profil invalide.");
  }
  return profileType;
}

export function isParentProfileType(value: unknown): boolean {
  return normalizeProfileType(value) === "PARENT";
}
