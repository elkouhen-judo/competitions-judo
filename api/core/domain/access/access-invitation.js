const { createProfileType } = require("./profile-type");

function createAccessInvitationRecord({ email, invited_profile_type, invited_by }) {
  if (!email) {
    throw new Error("Email d'invitation obligatoire.");
  }

  return {
    email,
    invited_profile_type: createProfileType(invited_profile_type),
    invited_by
  };
}

module.exports = {
  createAccessInvitationRecord
};
