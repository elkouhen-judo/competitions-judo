import type { JudokaModel } from "../domain/access/judoka";
import type { AccessRole } from "../domain/access/role";
import type { PersonName } from "../domain/access/person-name";
import { ID_BATCH_SIZE, inFilter, selectByIdBatches, uniqueIds } from "../shared/query";
import type { JudokaIdentity, JudokaRow, SupabaseRestDeps } from "./types";

/** Curseur de la liste paginée des utilisateurs : dernière ligne de la page précédente. */
export interface JudokaPageCursor {
  nom: string;
  prenom: string;
  id_judoka: string;
}

type JudokaIdentityRow = JudokaRow & {
  coach_clubs?: { id_club: string }[] | "";
  parent_judokas?: { id_judoka: string }[] | "";
};

export interface JudokaChangesInput {
  accountEmail?: string;
  email?: string;
  name?: PersonName;
  prenom?: string;
  nom?: string;
  profileType?: string;
  profile_type?: string;
  accessRole?: AccessRole;
  role?: string;
  pendingParentEmail?: string;
  ageCategory?: string;
  weightCategory?: string;
  beltColor?: string;
  gender?: string;
  yearInCategory?: string;
  handedness?: string;
}

export interface JudokasRepository {
  getByEmail(email: string): Promise<JudokaRow | null>;
  getIdentityByEmail(email: string): Promise<JudokaIdentity | null>;
  listPage(options: {
    search?: string;
    after?: JudokaPageCursor | null;
    limit: number;
  }): Promise<{ rows: JudokaRow[]; total: number }>;
  getById(idJudoka: string): Promise<JudokaRow | null>;
  getByName(prenom: string, nom: string): Promise<JudokaRow | null>;
  insert(
    judoka: JudokaModel,
    extras?: {
      categorie_age?: string;
      couleur_ceinture?: string;
      pending_parent_email?: string;
      genre?: string;
      annee_categorie?: string;
      lateralite?: string;
    }
  ): Promise<JudokaRow | null>;
  listAdmins(): Promise<JudokaRow[]>;
  listCoaches(): Promise<JudokaRow[]>;
  listAll(): Promise<JudokaRow[]>;
  listByIds(ids: string[]): Promise<JudokaRow[]>;
  listByClubIds(clubIds: string[]): Promise<JudokaRow[]>;
  countByClub(idClub: string): Promise<number>;
  setClub(idJudoka: string, idClub: string | null): Promise<void>;
  setAdminFlag(idJudoka: string, isAdmin: boolean): Promise<void>;
  remove(idJudoka: string): Promise<void>;
  saveJudokaInfo(
    idJudoka: string,
    ageCategory: string,
    weightCategory: string,
    beltColor: string,
    gender: string,
    yearInCategory: string,
    handedness: string
  ): Promise<void>;
  update(idJudoka: string, judokaChanges: JudokaChangesInput): Promise<JudokaRow | null>;
}

export default function createJudokasRepository(deps: SupabaseRestDeps): JudokasRepository {
  const {
    supabaseDelete,
    supabaseInsert,
    supabasePatch,
    supabaseSelect,
    supabaseSelectOne,
    supabaseSelectPage,
    eqFilter
  } = deps;

  function toJudokaRecord(judoka: JudokaModel): Record<string, unknown> {
    return {
      id_judoka: judoka.judokaId,
      email: judoka.accountEmail,
      prenom: judoka.name.firstName,
      nom: judoka.name.lastName,
      profile_type: judoka.profileType,
      role: judoka.accessRole
    };
  }

  function toJudokaChangesRecord(changes: JudokaChangesInput): Record<string, unknown> {
    const record: Record<string, unknown> = {};

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
    if (changes.pendingParentEmail !== undefined) {
      record.pending_parent_email = changes.pendingParentEmail;
    }
    if (changes.ageCategory !== undefined) {
      record.categorie_age = changes.ageCategory;
    }
    if (changes.weightCategory !== undefined) {
      record.categorie_poids = changes.weightCategory;
    }
    if (changes.beltColor !== undefined) {
      record.couleur_ceinture = changes.beltColor;
    }
    if (changes.gender !== undefined) {
      record.genre = changes.gender;
    }
    if (changes.yearInCategory !== undefined) {
      record.annee_categorie = changes.yearInCategory;
    }
    if (changes.handedness !== undefined) {
      record.lateralite = changes.handedness;
    }

    return record;
  }

  function findEmailQueryValue(email: string): string {
    return encodeURIComponent(String(email || "").trim());
  }

  function findNameQueryValue(name: string): string {
    return encodeURIComponent(String(name || "").trim());
  }

  async function listAll(): Promise<JudokaRow[]> {
    return supabaseSelect<JudokaRow>("judokas", `select=*&${JUDOKA_ORDER}`);
  }

  async function listAdmins(): Promise<JudokaRow[]> {
    return supabaseSelect<JudokaRow>(
      "judokas",
      `select=*&or=(role.eq.ADMIN,is_admin.is.true)&${JUDOKA_ORDER}`
    );
  }

  const JUDOKA_ORDER = "order=nom.asc,prenom.asc,id_judoka.asc";

  function sortByName(rows: JudokaRow[]): JudokaRow[] {
    return [...rows].sort(
      (a, b) =>
        String(a.nom).localeCompare(String(b.nom), "fr") ||
        String(a.prenom).localeCompare(String(b.prenom), "fr") ||
        String(a.id_judoka).localeCompare(String(b.id_judoka))
    );
  }

  async function listCoaches(): Promise<JudokaRow[]> {
    return supabaseSelect<JudokaRow>("judokas", `select=*&role=eq.COACH&${JUDOKA_ORDER}`);
  }

  async function listByIds(ids: string[]): Promise<JudokaRow[]> {
    const rows = await selectByIdBatches(ids, (batchIds) =>
      supabaseSelect<JudokaRow>("judokas", `select=*&${inFilter("id_judoka", batchIds)}&${JUDOKA_ORDER}`)
    );
    // Plusieurs lots : chaque lot est trié par la base, l'ensemble est retrié.
    return uniqueIds(ids).length > ID_BATCH_SIZE ? sortByName(rows) : rows;
  }

  // PostgREST : une valeur entre guillemets accepte virgules et parenthèses dans un filtre logique.
  function quoteLogicValue(value: string): string {
    const escaped = value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    return encodeURIComponent(`"${escaped}"`);
  }

  // PAGE-3 : une page d'utilisateurs triée par nom, lue après un curseur (et non par décalage).
  async function listPage(options: {
    search?: string;
    after?: JudokaPageCursor | null;
    limit: number;
  }): Promise<{ rows: JudokaRow[]; total: number }> {
    const filters: string[] = [];
    // Chaque mot de la recherche doit se trouver dans le nom, le prénom ou l'e-mail.
    const words = String(options.search || "").replace(/[%_*]/g, " ").split(/\s+/).filter(Boolean);
    if (words.length) {
      const wordFilters = words.map((word) => {
        const pattern = quoteLogicValue(`*${word}*`);
        return `or(nom.ilike.${pattern},prenom.ilike.${pattern},email.ilike.${pattern})`;
      });
      filters.push(`and=(${wordFilters.join(",")})`);
    }
    const after = options.after;
    if (!after) {
      return supabaseSelectPage<JudokaRow>(
        "judokas",
        ["select=*", ...filters, JUDOKA_ORDER].join("&"),
        options.limit
      );
    }

    const nom = quoteLogicValue(after.nom);
    const prenom = quoteLogicValue(after.prenom);
    const id = quoteLogicValue(after.id_judoka);
    const afterCursor = `or=(nom.gt.${nom},and(nom.eq.${nom},prenom.gt.${prenom}),and(nom.eq.${nom},prenom.eq.${prenom},id_judoka.gt.${id}))`;
    // Le total porte sur la recherche entière, pas sur la suite du curseur.
    const [page, whole] = await Promise.all([
      supabaseSelectPage<JudokaRow>(
        "judokas",
        ["select=*", ...filters, afterCursor, JUDOKA_ORDER].join("&"),
        options.limit
      ),
      supabaseSelectPage<JudokaRow>("judokas", ["select=id_judoka", ...filters].join("&"), 1)
    ]);
    return { rows: page.rows, total: whole.total };
  }

  // CTX-1 : le compte, les clubs qu'il coache et ses enfants rattachés, en une requête.
  async function getIdentityByEmail(email: string): Promise<JudokaIdentity | null> {
    const row = await supabaseSelectOne<JudokaIdentityRow>(
      "judokas",
      `select=*,coach_clubs(id_club),parent_judokas!parent_judokas_id_parent_fkey(id_judoka)&email=ilike.${findEmailQueryValue(email)}`
    );
    if (!row) {
      return null;
    }
    const { coach_clubs: coachClubs, parent_judokas: parentLinks, ...user } = row;
    return {
      user,
      coachClubIds: uniqueIds((coachClubs || []).map((link) => link.id_club)),
      childJudokaIds: uniqueIds((parentLinks || []).map((link) => link.id_judoka))
    };
  }

  async function getByEmail(email: string): Promise<JudokaRow | null> {
    return supabaseSelectOne<JudokaRow>(
      "judokas",
      `select=*&email=ilike.${findEmailQueryValue(email)}`
    );
  }

  async function getByName(prenom: string, nom: string): Promise<JudokaRow | null> {
    return supabaseSelectOne<JudokaRow>(
      "judokas",
      `select=*&prenom=ilike.${findNameQueryValue(prenom)}&nom=ilike.${findNameQueryValue(nom)}`
    );
  }

  async function getById(idJudoka: string): Promise<JudokaRow | null> {
    return supabaseSelectOne<JudokaRow>("judokas", `select=*&${eqFilter("id_judoka", idJudoka)}`);
  }

  async function insert(
    judoka: JudokaModel,
    extras?: {
      categorie_age?: string;
      couleur_ceinture?: string;
      pending_parent_email?: string;
      genre?: string;
      annee_categorie?: string;
      lateralite?: string;
    }
  ): Promise<JudokaRow | null> {
    const record: Record<string, unknown> = { ...toJudokaRecord(judoka) };
    if (extras) {
      if (extras.categorie_age !== undefined) record["categorie_age"] = extras.categorie_age;
      if (extras.couleur_ceinture !== undefined) {
        record["couleur_ceinture"] = extras.couleur_ceinture;
      }
      if (extras.pending_parent_email !== undefined) {
        record["pending_parent_email"] = extras.pending_parent_email;
      }
      if (extras.genre !== undefined) record["genre"] = extras.genre;
      if (extras.annee_categorie !== undefined) record["annee_categorie"] = extras.annee_categorie;
      if (extras.lateralite !== undefined) record["lateralite"] = extras.lateralite;
    }
    return supabaseInsert<JudokaRow>("judokas", record);
  }

  async function listByClubIds(clubIds: string[]): Promise<JudokaRow[]> {
    const ids = uniqueIds(clubIds);
    if (!ids.length) {
      return [];
    }
    return supabaseSelect<JudokaRow>("judokas", `select=*&${inFilter("club_id", ids)}&${JUDOKA_ORDER}`);
  }

  async function countByClub(idClub: string): Promise<number> {
    const { total } = await supabaseSelectPage<Pick<JudokaRow, "id_judoka">>(
      "judokas",
      `select=id_judoka&${eqFilter("club_id", idClub)}`,
      1
    );
    return total;
  }

  async function setClub(idJudoka: string, idClub: string | null): Promise<void> {
    await supabasePatch("judokas", eqFilter("id_judoka", idJudoka), { club_id: idClub || null });
  }

  async function setAdminFlag(idJudoka: string, isAdmin: boolean): Promise<void> {
    await supabasePatch("judokas", eqFilter("id_judoka", idJudoka), { is_admin: Boolean(isAdmin) });
  }

  async function update(
    idJudoka: string,
    judokaChanges: JudokaChangesInput
  ): Promise<JudokaRow | null> {
    return supabasePatch<JudokaRow>(
      "judokas",
      eqFilter("id_judoka", idJudoka),
      toJudokaChangesRecord(judokaChanges)
    );
  }

  async function remove(idJudoka: string): Promise<void> {
    return supabaseDelete("judokas", eqFilter("id_judoka", idJudoka));
  }

  async function saveJudokaInfo(
    idJudoka: string,
    ageCategory: string,
    weightCategory: string,
    beltColor: string,
    gender: string,
    yearInCategory: string,
    handedness: string
  ): Promise<void> {
    await supabasePatch("judokas", eqFilter("id_judoka", idJudoka), {
      categorie_age: ageCategory,
      categorie_poids: weightCategory,
      couleur_ceinture: beltColor,
      genre: gender,
      annee_categorie: yearInCategory,
      lateralite: handedness
    });
  }

  return {
    getByEmail,
    getIdentityByEmail,
    getById,
    getByName,
    insert,
    listAdmins,
    listAll,
    listCoaches,
    listPage,
    listByIds,
    listByClubIds,
    countByClub,
    setClub,
    setAdminFlag,
    remove,
    saveJudokaInfo,
    update
  };
}
