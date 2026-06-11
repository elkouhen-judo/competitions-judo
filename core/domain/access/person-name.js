function cleanNamePart(value) {
  return String(value || "").trim();
}

function createPersonName({ firstName, lastName } = {}) {
  const normalizedFirstName = cleanNamePart(firstName);
  const normalizedLastName = cleanNamePart(lastName);

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

function createOptionalPersonName({ firstName, lastName } = {}) {
  const normalizedFirstName = cleanNamePart(firstName);
  const normalizedLastName = cleanNamePart(lastName);

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
