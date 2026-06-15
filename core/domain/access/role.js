function normalizeRole(value) {
  return (
    String(value || "")
      .toUpperCase()
      .trim() || "NORMAL"
  );
}

function createRole(value) {
  const role = normalizeRole(value);
  if (!["NORMAL", "COACH", "ADMIN"].includes(role)) {
    throw new Error("Rôle invalide.");
  }
  return role;
}

function isCoachRole(value) {
  return normalizeRole(value) === "COACH";
}

function isAdminRole(value) {
  return normalizeRole(value) === "ADMIN";
}

module.exports = {
  createRole,
  isAdminRole,
  isCoachRole,
  normalizeRole
};
