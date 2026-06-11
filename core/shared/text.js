function cleanText(value) {
  return String(value || "").trim();
}

function normalizeLastName(value) {
  return cleanText(value).toLocaleUpperCase("fr-FR");
}

function normalizeEmail(value) {
  return cleanText(value).toLowerCase();
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || ""));
}

module.exports = {
  cleanText,
  isValidEmail,
  normalizeEmail,
  normalizeLastName
};
