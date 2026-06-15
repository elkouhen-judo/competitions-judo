const { toCanonicalJudoka, toInvitationReadModel } = require("./domain-adapters");

module.exports = function createAdminService(deps) {
  const {
    invitationsRepository,
    judokasRepository,
    userContextService,
    createAccessInvitation,
    createEmail,
    createJudoka,
    normalizeEmail
  } = deps;

  async function requireAdminUser(email) {
    const user = await userContextService.getCurrentUser(email);
    if (!user) {
      throw new Error(`Accès refusé pour : ${email}`);
    }
    if (!createJudoka(toCanonicalJudoka(user)).isAdmin()) {
      throw new Error("Gestion des admins réservée aux admins.");
    }
    return user;
  }

  async function getAdmins() {
    return judokasRepository.listAdmins();
  }

  async function getAccessInvitation(email) {
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) {
      return null;
    }

    return invitationsRepository.getByEmail(normalizedEmail);
  }

  async function getAccessInvitations() {
    return invitationsRepository.listAll();
  }

  async function getAdminsManagement(email) {
    const user = await requireAdminUser(email);
    return {
      user: toCanonicalJudoka(user),
      admins: (await getAdmins()).map(toCanonicalJudoka),
      accessInvitations: (await getAccessInvitations()).map(toInvitationReadModel)
    };
  }

  async function grantAdminRole(email, targetEmail) {
    await requireAdminUser(email);
    const normalizedEmail = createEmail(targetEmail);

    const target = await userContextService.getCurrentUser(normalizedEmail);
    if (!target) {
      throw new Error("Aucun judoka trouvé avec cet email.");
    }

    await judokasRepository.update(target.id_judoka, createJudoka(toCanonicalJudoka(target)).grantAdminRole());

    return {
      success: true,
      judokaId: target.id_judoka,
      message: "Droits admin accordés."
    };
  }

  async function saveAccessInvitation(email, targetEmail, targetProfileType) {
    const user = await requireAdminUser(email);
    const invitation = createAccessInvitation({
      email: targetEmail,
      invited_profile_type: targetProfileType,
      invited_by: user.id_judoka
    });

    const existingUser = await userContextService.getCurrentUser(invitation.email);
    if (existingUser) {
      throw new Error("Ce compte dispose déjà d'un accès.");
    }

    const existingInvitation = await getAccessInvitation(invitation.email);
    if (existingInvitation) {
      throw new Error("Cette adresse est déjà invitée.");
    }

    await invitationsRepository.insert(invitation);

    return {
      success: true,
      email: invitation.email,
      invitedProfileType: toInvitationReadModel(invitation).invitedProfileType,
      message: "Invitation d'accès enregistrée."
    };
  }

  async function revokeAdminRole(email, idJudoka) {
    const user = await requireAdminUser(email);
    if (!idJudoka) {
      throw new Error("Admin obligatoire.");
    }
    if (String(user.id_judoka) === String(idJudoka)) {
      throw new Error("Vous ne pouvez pas retirer vos propres droits admin.");
    }

    const target = await userContextService.getJudokaById(idJudoka);
    if (!target) {
      throw new Error("Admin introuvable.");
    }

    await judokasRepository.update(idJudoka, createJudoka(toCanonicalJudoka(target)).revokeAdminRole(user.id_judoka));

    return { success: true, message: "Droits admin retirés." };
  }

  async function deleteAccessInvitation(email, invitedEmail) {
    await requireAdminUser(email);
    const normalizedEmail = normalizeEmail(invitedEmail);
    if (!normalizedEmail) {
      throw new Error("Invitation obligatoire.");
    }

    const invitation = await getAccessInvitation(normalizedEmail);
    if (!invitation) {
      throw new Error("Invitation introuvable.");
    }

    await invitationsRepository.removeByEmail(normalizedEmail);
    return { success: true, message: "Invitation supprimée." };
  }

  return {
    getAccessInvitation,
    methods: {
      deleteAccessInvitation,
      getAdminsManagement,
      grantAdminRole,
      revokeAdminRole,
      saveAccessInvitation
    }
  };
};
