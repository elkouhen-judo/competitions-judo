export function normalizeEmail(value: unknown): string {
  return String(value || "")
    .trim()
    .toLowerCase();
}

export function isValidEmail(value: unknown): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || ""));
}

export function createEmail(
  value: unknown,
  message = "Email invalide.",
  requiredMessage = "Email obligatoire."
): string {
  const email = normalizeEmail(value);
  if (!email) {
    throw new Error(requiredMessage);
  }
  if (!isValidEmail(email)) {
    throw new Error(message);
  }
  return email;
}

export function createOptionalEmail(value: unknown, message = "Email invalide."): string | null {
  const email = normalizeEmail(value);
  if (!email) {
    return null;
  }
  if (!isValidEmail(email)) {
    throw new Error(message);
  }
  return email;
}
