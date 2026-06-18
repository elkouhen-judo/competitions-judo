import type { JudokaModel } from "../domain/access/judoka";
import type { AccessRole } from "../domain/access/role";
import type { PersonName } from "../domain/access/person-name";
import type { JudokaRow, SupabaseRestDeps } from "./types";

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
  listAll(): Promise<JudokaRow[]>;
  listByIds(ids: string[]): Promise<JudokaRow[]>;
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
    return supabaseSelect<JudokaRow>("judokas", "select=*&order=nom.asc,prenom.asc");
  }

  async function listAdmins(): Promise<JudokaRow[]> {
    return supabaseSelect<JudokaRow>("judokas", "select=*&role=eq.ADMIN&order=nom.asc,prenom.asc");
  }

  async function listByIds(ids: string[]): Promise<JudokaRow[]> {
    if (!ids || !ids.length) {
      return [];
    }
    return supabaseSelect<JudokaRow>(
      "judokas",
      `select=*&id_judoka=in.(${ids.join(",")})&order=nom.asc,prenom.asc`
    );
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
    getById,
    getByName,
    insert,
    listAdmins,
    listAll,
    listByIds,
    remove,
    saveJudokaInfo,
    update
  };
}
