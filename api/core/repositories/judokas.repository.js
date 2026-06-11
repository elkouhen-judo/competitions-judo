module.exports = function createJudokasRepository(deps) {
  const {
    supabaseDelete,
    supabaseInsert,
    supabasePatch,
    supabaseSelect,
    supabaseSelectOne,
    eqFilter
  } = deps;

  async function listAll() {
    return supabaseSelect("judokas", "select=*&order=nom.asc,prenom.asc");
  }

  async function listAdmins() {
    return supabaseSelect("judokas", "select=*&role=eq.ADMIN&order=nom.asc,prenom.asc");
  }

  async function listByIds(ids) {
    if (!ids || !ids.length) {
      return [];
    }
    return supabaseSelect("judokas", `select=*&id_judoka=in.(${ids.join(",")})&order=nom.asc,prenom.asc`);
  }

  async function getByEmail(email) {
    return supabaseSelectOne("judokas", `select=*&${eqFilter("email", email)}`);
  }

  async function getById(idJudoka) {
    return supabaseSelectOne("judokas", `select=*&${eqFilter("id_judoka", idJudoka)}`);
  }

  async function insert(payload) {
    return supabaseInsert("judokas", payload);
  }

  async function update(idJudoka, payload) {
    return supabasePatch("judokas", eqFilter("id_judoka", idJudoka), payload);
  }

  async function remove(idJudoka) {
    return supabaseDelete("judokas", eqFilter("id_judoka", idJudoka));
  }

  return {
    getByEmail,
    getById,
    insert,
    listAdmins,
    listAll,
    listByIds,
    remove,
    update
  };
};
