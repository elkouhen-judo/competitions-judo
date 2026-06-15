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
      id_judoka: judoka.judokaId || judoka.id_judoka,
      email: judoka.accountEmail !== undefined ? judoka.accountEmail : judoka.email,
      prenom: judoka.name ? judoka.name.firstName : judoka.prenom,
      nom: judoka.name ? judoka.name.lastName : judoka.nom,
      profile_type: judoka.profileType || judoka.profile_type,
      role: judoka.accessRole || judoka.role
    };
  }

  function toJudokaChangesRecord(changes) {
    const record = {};

    if (changes.accountEmail !== undefined || changes.email !== undefined) {
      record.email = changes.accountEmail !== undefined ? changes.accountEmail : changes.email;
    }
    if (changes.name || changes.prenom !== undefined) {
      record.prenom = changes.name ? changes.name.firstName : changes.prenom;
    }
    if (changes.name || changes.nom !== undefined) {
      record.nom = changes.name ? changes.name.lastName : changes.nom;
    }
    if (changes.profileType !== undefined || changes.profile_type !== undefined) {
      record.profile_type =
        changes.profileType !== undefined ? changes.profileType : changes.profile_type;
    }
    if (changes.accessRole !== undefined || changes.role !== undefined) {
      record.role = changes.accessRole !== undefined ? changes.accessRole : changes.role;
    }

    return record;
  }

  function toManagedChildUpdateRecord(child) {
    return {
      email: child.accountEmail !== undefined ? child.accountEmail : child.email,
      prenom: child.name ? child.name.firstName : child.prenom,
      nom: child.name ? child.name.lastName : child.nom
    };
  }

  function findEmailQueryValue(email) {
    return encodeURIComponent(String(email || "").trim());
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
    return supabaseSelect(
      "judokas",
      `select=*&id_judoka=in.(${ids.join(",")})&order=nom.asc,prenom.asc`
    );
  }

  async function getByEmail(email) {
    return supabaseSelectOne("judokas", `select=*&email=ilike.${findEmailQueryValue(email)}`);
  }

  async function getById(idJudoka) {
    return supabaseSelectOne("judokas", `select=*&${eqFilter("id_judoka", idJudoka)}`);
  }

  async function insert(judoka) {
    return supabaseInsert("judokas", toJudokaRecord(judoka));
  }

  async function update(idJudoka, judokaChanges) {
    return supabasePatch(
      "judokas",
      eqFilter("id_judoka", idJudoka),
      toJudokaChangesRecord(judokaChanges)
    );
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
