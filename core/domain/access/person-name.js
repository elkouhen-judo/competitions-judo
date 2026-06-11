function cleanNamePart(value) {
  return String(value || "").trim();
}

function createPersonName({ firstName, lastName, prenom, nom } = {}) {
  const normalizedFirstName = cleanNamePart(firstName || prenom);
  const normalizedLastName = cleanNamePart(lastName || nom);

  if (!normalizedFirstName || !normalizedLastName) {
    throw new Error("Prénom et nom de l'enfant obligatoires.");
  }

  return {
    firstName: normalizedFirstName,
    lastName: normalizedLastName,
    displayName() {
      return [normalizedFirstName, normalizedLastName].filter(Boolean).join(" ");
    }
  };
}

function createOptionalPersonName({ firstName, lastName, prenom, nom } = {}) {
  const normalizedFirstName = cleanNamePart(firstName || prenom);
  const normalizedLastName = cleanNamePart(lastName || nom);

  return {
    firstName: normalizedFirstName,
    lastName: normalizedLastName,
    displayName() {
      return [normalizedFirstName, normalizedLastName].filter(Boolean).join(" ");
    }
  };
}

module.exports = {
  createOptionalPersonName,
  createPersonName
};
