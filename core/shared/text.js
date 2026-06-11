function cleanText(value) {
  return String(value || "").trim();
}

function normalizeLastName(value) {
  return cleanText(value).toLocaleUpperCase("fr-FR");
}

function normalizeEmail(value) {
  return cleanText(value).toLowerCase();
}

module.exports = {
  cleanText,
  normalizeEmail,
  normalizeLastName
};
