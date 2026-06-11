function normalizeRole(value) {
  return String(value || "").toUpperCase().trim() || "NORMAL";
}

function createRole(value) {
  const role = normalizeRole(value);
  if (!["NORMAL", "ADMIN"].includes(role)) {
    throw new Error("Rôle invalide.");
  }
  return role;
}

function isAdminRole(value) {
  return normalizeRole(value) === "ADMIN";
}

module.exports = {
  createRole,
  isAdminRole,
  normalizeRole
};
