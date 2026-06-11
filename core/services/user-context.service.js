const { toDomainJudoka } = require("./domain-adapters");

module.exports = function createUserContextService(deps) {
  const {
    judokasRepository,
    parentLinksRepository,
    normalizeEmail,
    assertCanAccessJudokaProfile,
    createManagedJudokaScope,
    isAdmin,
    isParent
  } = deps;

  async function getCurrentUser(email) {
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) {
      return null;
    }

    return judokasRepository.getByEmail(normalizedEmail);
  }

  async function getJudokas() {
    return judokasRepository.listAll();
  }

  async function getJudokaById(idJudoka) {
    return judokasRepository.getById(idJudoka);
  }

  async function getParentManagedJudokas(idParent) {
    const rows = await parentLinksRepository.listByParent(idParent);
    if (!rows.length) return [];

    const ids = rows.map(row => row.id_judoka);
    return judokasRepository.listByIds(ids);
  }

  async function getManagedChild(idParent, idJudoka) {
    const link = await parentLinksRepository.getLink(idParent, idJudoka);
    if (!link) return null;
    return getJudokaById(idJudoka);
  }

  async function assertJudokaEmailAvailable(email, currentIdJudoka) {
    if (!email) {
      return;
    }

    const existingUser = await getCurrentUser(email);
    if (existingUser && String(existingUser.id_judoka) !== String(currentIdJudoka || "")) {
      throw new Error("Un autre profil utilise déjà cet email.");
    }
  }

  async function getCurrentUserContext(email) {
    const user = await getCurrentUser(email);

    if (!user) {
      throw new Error(`Accès refusé pour : ${email}`);
    }

    let judokas = [];
    let managedJudokaIds = [];
    let managedJudokaScope = createManagedJudokaScope([]);
    const domainUser = toDomainJudoka(user);

    if (isAdmin(domainUser)) {
      judokas = await getJudokas();
    } else if (isParent(domainUser)) {
      const children = await getParentManagedJudokas(user.id_judoka);
      const alreadyIncluded = children.some(j => String(j.id_judoka) === String(user.id_judoka));
      judokas = alreadyIncluded ? children : [user, ...children];
      managedJudokaIds = judokas.map(j => String(j.id_judoka));
      managedJudokaScope = createManagedJudokaScope(managedJudokaIds);
    }

    return { user, judokas, managedJudokaIds, managedJudokaScope };
  }

  async function getAccessibleJudokaProfile(email, idJudoka) {
    const userContext = await getCurrentUserContext(email);
    const user = userContext.user;
    const targetId = idJudoka || user.id_judoka;
    const target = await getJudokaById(targetId);

    if (!target) {
      throw new Error("Judoka introuvable.");
    }

    assertCanAccessJudokaProfile(toDomainJudoka(user), targetId, userContext.managedJudokaScope);
    return { user, target };
  }

  return {
    assertJudokaEmailAvailable,
    getAccessibleJudokaProfile,
    getCurrentUser,
    getCurrentUserContext,
    getJudokaById,
    getJudokas,
    getManagedChild,
    getParentManagedJudokas
  };
};
