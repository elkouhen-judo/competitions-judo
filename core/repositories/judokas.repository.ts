import type { JudokaModel, UpdateManagedChildResult } from "../domain/access/judoka";
import type { AccessRole } from "../domain/access/role";
import type { PersonName } from "../domain/access/person-name";
import type { JudokaRow, SupabaseRestDeps } from "./types";

export interface JudokaChangesInput {
  accountEmail?: unknown;
  email?: unknown;
  name?: PersonName;
  prenom?: unknown;
  nom?: unknown;
  profileType?: unknown;
  profile_type?: unknown;
  accessRole?: AccessRole;
  role?: unknown;
}

export interface JudokasRepository {
  getByEmail(email: unknown): Promise<JudokaRow | null>;
  getById(idJudoka: unknown): Promise<JudokaRow | null>;
  insert(judoka: JudokaModel): Promise<JudokaRow | null>;
  listAdmins(): Promise<JudokaRow[]>;
  listAll(): Promise<JudokaRow[]>;
  listByIds(ids: unknown[]): Promise<JudokaRow[]>;
  remove(idJudoka: unknown): Promise<void>;
  update(idJudoka: unknown, judokaChanges: JudokaChangesInput): Promise<JudokaRow | null>;
  updateManagedChild(idJudoka: unknown, child: UpdateManagedChildResult): Promise<JudokaRow | null>;
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

    return record;
  }

  function toManagedChildUpdateRecord(child: UpdateManagedChildResult): Record<string, unknown> {
    return {
      email: child.accountEmail,
      prenom: child.name.firstName,
      nom: child.name.lastName
    };
  }

  function findEmailQueryValue(email: unknown): string {
    return encodeURIComponent(String(email || "").trim());
  }

  async function listAll(): Promise<JudokaRow[]> {
    return supabaseSelect<JudokaRow>("judokas", "select=*&order=nom.asc,prenom.asc");
  }

  async function listAdmins(): Promise<JudokaRow[]> {
    return supabaseSelect<JudokaRow>("judokas", "select=*&role=eq.ADMIN&order=nom.asc,prenom.asc");
  }

  async function listByIds(ids: unknown[]): Promise<JudokaRow[]> {
    if (!ids || !ids.length) {
      return [];
    }
    return supabaseSelect<JudokaRow>(
      "judokas",
      `select=*&id_judoka=in.(${ids.join(",")})&order=nom.asc,prenom.asc`
    );
  }

  async function getByEmail(email: unknown): Promise<JudokaRow | null> {
    return supabaseSelectOne<JudokaRow>(
      "judokas",
      `select=*&email=ilike.${findEmailQueryValue(email)}`
    );
  }

  async function getById(idJudoka: unknown): Promise<JudokaRow | null> {
    return supabaseSelectOne<JudokaRow>("judokas", `select=*&${eqFilter("id_judoka", idJudoka)}`);
  }

  async function insert(judoka: JudokaModel): Promise<JudokaRow | null> {
    return supabaseInsert<JudokaRow>("judokas", toJudokaRecord(judoka));
  }

  async function update(
    idJudoka: unknown,
    judokaChanges: JudokaChangesInput
  ): Promise<JudokaRow | null> {
    return supabasePatch<JudokaRow>(
      "judokas",
      eqFilter("id_judoka", idJudoka),
      toJudokaChangesRecord(judokaChanges)
    );
  }

  async function updateManagedChild(
    idJudoka: unknown,
    child: UpdateManagedChildResult
  ): Promise<JudokaRow | null> {
    return update(idJudoka, toManagedChildUpdateRecord(child));
  }

  async function remove(idJudoka: unknown): Promise<void> {
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
}
