module.exports = function createInvitationsRepository(deps) {
  const {
    supabaseDelete,
    supabaseInsert,
    supabaseSelect,
    supabaseSelectOne,
    eqFilter
  } = deps;

  function toAccessInvitationRecord(invitation) {
    return {
      email: invitation.email,
      invited_profile_type: invitation.invited_profile_type,
      invited_by: invitation.invited_by
    };
  }

  async function getByEmail(email) {
    return supabaseSelectOne("access_invitations", `select=*&${eqFilter("email", email)}`);
  }

  async function listAll() {
    return supabaseSelect("access_invitations", "select=*&order=created_at.desc,email.asc");
  }

  async function insert(invitation) {
    return supabaseInsert("access_invitations", toAccessInvitationRecord(invitation));
  }

  async function removeByEmail(email) {
    return supabaseDelete("access_invitations", eqFilter("email", email));
  }

  return {
    getByEmail,
    insert,
    listAll,
    removeByEmail
  };
};
