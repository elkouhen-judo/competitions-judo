module.exports = function createRegistrationService(deps) {
  const { adminService, createEmail, supabaseRpc } = deps;

  async function registerProfile(email, profile) {
    const invitation = await adminService.getAccessInvitation(email);
    if (!invitation) {
      throw new Error("Accès non autorisé. Une invitation est requise.");
    }

    return supabaseRpc("register_profile", {
      p_email: createEmail(email),
      p_type: invitation.invited_profile_type || "JUDOKA",
      p_prenom: profile && profile.firstName,
      p_nom: profile && profile.lastName,
      p_children: []
    });
  }

  return {
    methods: {
      registerProfile
    }
  };
};
