module.exports = function createChildrenService(deps) {
  const {
    combatsRepository,
    competitionsRepository,
    judokasRepository,
    parentLinksRepository,
    userContextService,
    assertCanManageChildrenProfile,
    buildJudokaId,
    cleanText,
    isParent,
    isValidEmail,
    normalizeEmail
  } = deps;

  async function getChildrenManagement(email) {
    const user = await userContextService.getCurrentUser(email);
    if (!user) {
      throw new Error(`Accès refusé pour : ${email}`);
    }
    assertCanManageChildrenProfile(user);

    return {
      user,
      isParent: isParent(user),
      children: await userContextService.getParentManagedJudokas(user.id_judoka)
    };
  }

  async function saveManagedChild(email, child) {
    const user = await userContextService.getCurrentUser(email);
    if (!user) {
      throw new Error(`Accès refusé pour : ${email}`);
    }
    assertCanManageChildrenProfile(user);

    const prenom = cleanText(child && child.prenom);
    const nom = cleanText(child && child.nom);
    const childEmail = normalizeEmail(child && child.email);
    if (!prenom || !nom) {
      throw new Error("Prénom et nom de l'enfant obligatoires.");
    }
    if (childEmail && !isValidEmail(childEmail)) {
      throw new Error("Email de l'enfant invalide.");
    }
    await userContextService.assertJudokaEmailAvailable(childEmail, child && child.id_judoka);

    if (child && child.id_judoka) {
      const existingChild = await userContextService.getManagedChild(user.id_judoka, child.id_judoka);
      if (!existingChild) {
        throw new Error("Enfant introuvable.");
      }

      await judokasRepository.update(child.id_judoka, {
        prenom,
        nom,
        email: childEmail || null
      });

      return {
        success: true,
        id_judoka: child.id_judoka,
        message: "Enfant modifié."
      };
    }

    const idJudoka = buildJudokaId();
    await judokasRepository.insert({
      id_judoka: idJudoka,
      email: childEmail || null,
      prenom,
      nom,
      profile_type: "JUDOKA",
      role: "NORMAL"
    });
    await parentLinksRepository.insert({
      id_parent: user.id_judoka,
      id_judoka: idJudoka
    });

    return {
      success: true,
      id_judoka: idJudoka,
      message: "Enfant ajouté."
    };
  }

  async function deleteManagedChild(email, idJudoka) {
    const user = await userContextService.getCurrentUser(email);
    if (!user) {
      throw new Error(`Accès refusé pour : ${email}`);
    }
    assertCanManageChildrenProfile(user);

    if (!idJudoka) {
      throw new Error("Enfant obligatoire.");
    }

    const child = await userContextService.getManagedChild(user.id_judoka, idJudoka);
    if (!child) {
      throw new Error("Enfant introuvable.");
    }

    const competition = await competitionsRepository.existsForJudoka(idJudoka);
    if (competition) {
      throw new Error("Impossible de supprimer cet enfant tant qu'il possède des compétitions.");
    }

    const combat = await combatsRepository.existsForJudoka(idJudoka);
    if (combat) {
      throw new Error("Impossible de supprimer cet enfant tant qu'il possède des combats.");
    }

    await parentLinksRepository.remove(user.id_judoka, idJudoka);

    const otherParentLink = await parentLinksRepository.getAnyByJudoka(idJudoka);
    let message = "Enfant retiré.";
    if (!otherParentLink && !cleanText(child.email)) {
      await judokasRepository.remove(idJudoka);
      message = "Enfant supprimé.";
    }
    return {
      success: true,
      message
    };
  }

  return {
    methods: {
      deleteManagedChild,
      getChildrenManagement,
      saveManagedChild
    }
  };
};
