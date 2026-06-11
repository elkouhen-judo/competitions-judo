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
    createManagedChild,
    createJudoka,
    decideManagedChildRemoval,
    isParent,
    updateManagedChild
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

    const firstName = cleanText(child && (child.firstName || child.prenom));
    const lastName = cleanText(child && (child.lastName || child.nom));

    if (child && (child.judokaId || child.id_judoka)) {
      const childJudokaId = child.judokaId || child.id_judoka;
      const existingChild = await userContextService.getManagedChild(user.id_judoka, childJudokaId);
      if (!existingChild) {
        throw new Error("Enfant introuvable.");
      }

      const updatedChild = updateManagedChild({
        firstName,
        lastName,
        accountEmail: child.accountEmail !== undefined ? child.accountEmail : child.email
      });
      await userContextService.assertJudokaEmailAvailable(updatedChild.accountEmail, childJudokaId);
      await judokasRepository.updateManagedChild(childJudokaId, updatedChild);

      return {
        success: true,
        id_judoka: childJudokaId,
        message: "Enfant modifié."
      };
    }

    const idJudoka = buildJudokaId();
    const managedChild = createManagedChild({
      judokaId: idJudoka,
      accountEmail: child && (child.accountEmail !== undefined ? child.accountEmail : child.email),
      firstName,
      lastName
    });
    await userContextService.assertJudokaEmailAvailable(managedChild.accountEmail, idJudoka);
    await judokasRepository.insert(managedChild);
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
    const combat = await combatsRepository.existsForJudoka(idJudoka);
    const otherParentLink = await parentLinksRepository.getOtherByJudoka(idJudoka, user.id_judoka);
    const deletionDecision = decideManagedChildRemoval({
      child: createJudoka(child),
      hasCompetitions: Boolean(competition),
      hasCombats: Boolean(combat),
      hasOtherParentLink: Boolean(otherParentLink)
    });

    await parentLinksRepository.remove(user.id_judoka, idJudoka);

    if (deletionDecision.removeJudoka) {
      await judokasRepository.remove(idJudoka);
    }
    return {
      success: true,
      message: deletionDecision.message
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
