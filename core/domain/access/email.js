function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || ""));
}

function createEmail(value, message = "Email invalide.", requiredMessage = "Email obligatoire.") {
  const email = normalizeEmail(value);
  if (!email) {
    throw new Error(requiredMessage);
  }
  if (!isValidEmail(email)) {
    throw new Error(message);
  }
  return email;
}

function createOptionalEmail(value, message = "Email invalide.") {
  const email = normalizeEmail(value);
  if (!email) {
    return null;
  }
  if (!isValidEmail(email)) {
    throw new Error(message);
  }
  return email;
}

module.exports = {
  createEmail,
  createOptionalEmail,
  isValidEmail,
  normalizeEmail
};
