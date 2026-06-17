import type { ParentLinkRow, SupabaseRestDeps } from "./types";

export interface ParentLinksRepository {
  insert(payload: ParentLinkRow): Promise<ParentLinkRow | null>;
  listByParent(idParent: string): Promise<Pick<ParentLinkRow, "id_judoka">[]>;
}

export default function createParentLinksRepository(deps: SupabaseRestDeps): ParentLinksRepository {
  const { supabaseInsert, supabaseSelect, eqFilter } = deps;

  async function listByParent(idParent: string): Promise<Pick<ParentLinkRow, "id_judoka">[]> {
    return supabaseSelect<Pick<ParentLinkRow, "id_judoka">>(
      "parent_judokas",
      `select=id_judoka&${eqFilter("id_parent", idParent)}`
    );
  }

  async function insert(payload: ParentLinkRow): Promise<ParentLinkRow | null> {
    return supabaseInsert<ParentLinkRow>("parent_judokas", payload);
  }

  return {
    insert,
    listByParent
  };
}
