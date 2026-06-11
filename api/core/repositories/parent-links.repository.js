module.exports = function createParentLinksRepository(deps) {
  const {
    supabaseDelete,
    supabaseInsert,
    supabaseSelect,
    supabaseSelectOne,
    eqFilter
  } = deps;

  async function listByParent(idParent) {
    return supabaseSelect("parent_judokas", `select=id_judoka&${eqFilter("id_parent", idParent)}`);
  }

  async function getLink(idParent, idJudoka) {
    return supabaseSelectOne(
      "parent_judokas",
      `select=id_parent,id_judoka&${eqFilter("id_parent", idParent)}&${eqFilter("id_judoka", idJudoka)}`
    );
  }

  async function getAnyByJudoka(idJudoka) {
    return supabaseSelectOne("parent_judokas", `select=id_parent&${eqFilter("id_judoka", idJudoka)}`);
  }

  async function insert(payload) {
    return supabaseInsert("parent_judokas", payload);
  }

  async function remove(idParent, idJudoka) {
    return supabaseDelete("parent_judokas", `${eqFilter("id_parent", idParent)}&${eqFilter("id_judoka", idJudoka)}`);
  }

  return {
    getAnyByJudoka,
    getLink,
    insert,
    listByParent,
    remove
  };
};
