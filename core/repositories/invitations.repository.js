module.exports = function createInvitationsRepository(deps) {
  const { supabaseDelete, supabaseInsert, supabaseSelect, supabaseSelectOne } = deps;

  function toAccessInvitationRecord(invitation) {
    return {
      email: invitation.email,
      invited_profile_type: invitation.invited_profile_type,
      invited_by: invitation.invited_by
    };
  }

  function findEmailQueryValue(email) {
    return encodeURIComponent(String(email || "").trim());
  }

  async function getByEmail(email) {
    return supabaseSelectOne(
      "access_invitations",
      `select=*&email=ilike.${findEmailQueryValue(email)}`
    );
  }

  async function listAll() {
    return supabaseSelect("access_invitations", "select=*&order=created_at.desc,email.asc");
  }

  async function insert(invitation) {
    return supabaseInsert("access_invitations", toAccessInvitationRecord(invitation));
  }

  async function removeByEmail(email) {
    return supabaseDelete("access_invitations", `email=ilike.${findEmailQueryValue(email)}`);
  }

  return {
    getByEmail,
    insert,
    listAll,
    removeByEmail
  };
};
