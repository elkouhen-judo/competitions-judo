export function cleanText(value: unknown): string {
  return String(value || "").trim();
}

export function normalizeLastName(value: unknown): string {
  return cleanText(value).toLocaleUpperCase("fr-FR");
}

export function normalizeEmail(value: unknown): string {
  return cleanText(value).toLowerCase();
}
