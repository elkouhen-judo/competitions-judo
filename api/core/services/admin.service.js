module.exports = function createAdminService(deps) {
  const {
    invitationsRepository,
    judokasRepository,
    userContextService,
    cleanText,
    normalizeEmail,
    isAdmin,
    isValidEmail
  } = deps;

  async function requireAdminUser(email) {
    const user = await userContextService.getCurrentUser(email);
    if (!user) {
      throw new Error(`Accès refusé pour : ${email}`);
    }
    if (!isAdmin(user)) {
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
      user,
      admins: await getAdmins(),
      accessInvitations: await getAccessInvitations()
    };
  }

  async function grantAdminRole(email, targetEmail) {
    await requireAdminUser(email);
    const normalizedEmail = cleanText(targetEmail).toLowerCase();
    if (!normalizedEmail) {
      throw new Error("Email obligatoire.");
    }

    const target = await userContextService.getCurrentUser(normalizedEmail);
    if (!target) {
      throw new Error("Aucun judoka trouvé avec cet email.");
    }
    if (isAdmin(target)) {
      throw new Error("Cet utilisateur est déjà admin.");
    }

    await judokasRepository.update(target.id_judoka, { role: "ADMIN" });

    return {
      success: true,
      id_judoka: target.id_judoka,
      message: "Droits admin accordés."
    };
  }

  async function saveAccessInvitation(email, targetEmail, targetProfileType) {
    const user = await requireAdminUser(email);
    const normalizedEmail = normalizeEmail(targetEmail);
    const normalizedProfileType = String(targetProfileType || "").toUpperCase().trim() || "JUDOKA";
    if (!normalizedEmail) {
      throw new Error("Email d'invitation obligatoire.");
    }
    if (!isValidEmail(normalizedEmail)) {
      throw new Error("Email d'invitation invalide.");
    }
    if (!["JUDOKA", "PARENT"].includes(normalizedProfileType)) {
      throw new Error("Type de profil invalide.");
    }

    const existingUser = await userContextService.getCurrentUser(normalizedEmail);
    if (existingUser) {
      throw new Error("Ce compte dispose déjà d'un accès.");
    }

    const existingInvitation = await getAccessInvitation(normalizedEmail);
    if (existingInvitation) {
      throw new Error("Cette adresse est déjà invitée.");
    }

    await invitationsRepository.insert({
      email: normalizedEmail,
      invited_profile_type: normalizedProfileType,
      invited_by: user.id_judoka
    });

    return {
      success: true,
      email: normalizedEmail,
      invited_profile_type: normalizedProfileType,
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
    if (!target || !isAdmin(target)) {
      throw new Error("Admin introuvable.");
    }

    await judokasRepository.update(idJudoka, { role: "NORMAL" });

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
