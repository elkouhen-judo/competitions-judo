module.exports = function createInvitationsRepository(deps) {
  const {
    supabaseDelete,
    supabaseInsert,
    supabaseSelect,
    supabaseSelectOne,
    eqFilter
  } = deps;

  async function getByEmail(email) {
    return supabaseSelectOne("access_invitations", `select=*&${eqFilter("email", email)}`);
  }

  async function listAll() {
    return supabaseSelect("access_invitations", "select=*&order=created_at.desc,email.asc");
  }

  async function insert(payload) {
    return supabaseInsert("access_invitations", payload);
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
