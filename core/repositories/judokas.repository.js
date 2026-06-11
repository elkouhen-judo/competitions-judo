module.exports = function createJudokasRepository(deps) {
  const {
    supabaseDelete,
    supabaseInsert,
    supabasePatch,
    supabaseSelect,
    supabaseSelectOne,
    eqFilter
  } = deps;

  function toJudokaRecord(judoka) {
    return {
      id_judoka: judoka.id_judoka,
      email: judoka.email,
      prenom: judoka.prenom,
      nom: judoka.nom,
      profile_type: judoka.profile_type,
      role: judoka.role
    };
  }

  function toManagedChildUpdateRecord(child) {
    return {
      email: child.email,
      prenom: child.prenom,
      nom: child.nom
    };
  }

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

  async function insert(judoka) {
    return supabaseInsert("judokas", toJudokaRecord(judoka));
  }

  async function update(idJudoka, judokaChanges) {
    return supabasePatch("judokas", eqFilter("id_judoka", idJudoka), judokaChanges);
  }

  async function updateManagedChild(idJudoka, child) {
    return update(idJudoka, toManagedChildUpdateRecord(child));
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
    update,
    updateManagedChild
  };
};
