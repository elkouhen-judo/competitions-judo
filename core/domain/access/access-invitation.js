const { createProfileType } = require("./profile-type");

function createAccessInvitation({ email, invited_profile_type, invited_by }) {
  if (!email) {
    throw new Error("Email d'invitation obligatoire.");
  }

  const record = {
    email,
    invited_profile_type: createProfileType(invited_profile_type),
    invited_by
  };

  return {
    ...record,
    toRecord() {
      return { ...record };
    }
  };
}

function createAccessInvitationRecord({ email, invited_profile_type, invited_by }) {
  return createAccessInvitation({ email, invited_profile_type, invited_by }).toRecord();
}

module.exports = {
  createAccessInvitation,
  createAccessInvitationRecord
};
