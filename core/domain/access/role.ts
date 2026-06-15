export type AccessRole = "NORMAL" | "COACH" | "ADMIN";

export function normalizeRole(value: unknown): string {
  return (
    String(value || "")
      .toUpperCase()
      .trim() || "NORMAL"
  );
}

export function createRole(value: unknown): AccessRole {
  const role = normalizeRole(value);
  if (role !== "NORMAL" && role !== "COACH" && role !== "ADMIN") {
    throw new Error("Rôle invalide.");
  }
  return role;
}

export function isCoachRole(value: unknown): boolean {
  return normalizeRole(value) === "COACH";
}

export function isAdminRole(value: unknown): boolean {
  return normalizeRole(value) === "ADMIN";
}
