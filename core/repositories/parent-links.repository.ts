import { inFilter, selectByIdBatches } from "../shared/query";
import type { ParentLinkRow, SupabaseRestDeps } from "./types";

export interface ParentLinksRepository {
  insert(payload: ParentLinkRow): Promise<ParentLinkRow | null>;
  listByParent(idParent: string): Promise<Pick<ParentLinkRow, "id_judoka">[]>;
  /** CLUBADM-002 : les parents des judokas d'un club, pour la gestion des accès du club. */
  listByChildren(childIds: string[]): Promise<ParentLinkRow[]>;
}

export default function createParentLinksRepository(deps: SupabaseRestDeps): ParentLinksRepository {
  const { supabaseInsert, supabaseSelect, eqFilter } = deps;

  async function listByParent(idParent: string): Promise<Pick<ParentLinkRow, "id_judoka">[]> {
    return supabaseSelect<Pick<ParentLinkRow, "id_judoka">>(
      "parent_judokas",
      `select=id_judoka&${eqFilter("id_parent", idParent)}&order=id_judoka.asc`
    );
  }

  async function listByChildren(childIds: string[]): Promise<ParentLinkRow[]> {
    return selectByIdBatches(childIds, (batchIds) =>
      supabaseSelect<ParentLinkRow>(
        "parent_judokas",
        `select=id_parent,id_judoka&${inFilter("id_judoka", batchIds)}&order=id_parent.asc,id_judoka.asc`
      )
    );
  }

  async function insert(payload: ParentLinkRow): Promise<ParentLinkRow | null> {
    return supabaseInsert<ParentLinkRow>("parent_judokas", payload);
  }

  return {
    insert,
    listByChildren,
    listByParent
  };
}
