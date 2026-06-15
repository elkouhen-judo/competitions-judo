function normalizeProfileType(value) {
  return (
    String(value || "")
      .toUpperCase()
      .trim() || "JUDOKA"
  );
}

function createProfileType(value) {
  const profileType = normalizeProfileType(value);
  if (!["JUDOKA", "PARENT"].includes(profileType)) {
    throw new Error("Type de profil invalide.");
  }
  return profileType;
}

function isParentProfileType(value) {
  return normalizeProfileType(value) === "PARENT";
}

module.exports = {
  createProfileType,
  isParentProfileType,
  normalizeProfileType
};
