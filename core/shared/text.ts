export function cleanText(value) {
  return String(value || "").trim();
}

export function normalizeLastName(value) {
  return cleanText(value).toLocaleUpperCase("fr-FR");
}

export function normalizeEmail(value) {
  return cleanText(value).toLowerCase();
}
