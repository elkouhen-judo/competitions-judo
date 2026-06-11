const { createEmail } = require("./email");
const { createProfileType } = require("./profile-type");

function createAccessInvitation({ email, invited_profile_type, invited_by }) {
  const record = {
    email: createEmail(email, "Email d'invitation invalide.", "Email d'invitation obligatoire."),
    invited_profile_type: createProfileType(invited_profile_type),
    invited_by
  };

  return {
    ...record
  };
}

module.exports = {
  createAccessInvitation
};
