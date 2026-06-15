import type { ParentLinkRow, SupabaseRestDeps } from "./types";

export interface ParentLinksRepository {
  getLink(idParent: string, idJudoka: string): Promise<ParentLinkRow | null>;
  getOtherByJudoka(idJudoka: string, excludedParentId: string): Promise<ParentLinkRow | null>;
  insert(payload: ParentLinkRow): Promise<ParentLinkRow | null>;
  listByParent(idParent: string): Promise<Pick<ParentLinkRow, "id_judoka">[]>;
  remove(idParent: string, idJudoka: string): Promise<void>;
}

export default function createParentLinksRepository(deps: SupabaseRestDeps): ParentLinksRepository {
  const { supabaseDelete, supabaseInsert, supabaseSelect, supabaseSelectOne, eqFilter } = deps;

  async function listByParent(idParent: string): Promise<Pick<ParentLinkRow, "id_judoka">[]> {
    return supabaseSelect<Pick<ParentLinkRow, "id_judoka">>(
      "parent_judokas",
      `select=id_judoka&${eqFilter("id_parent", idParent)}`
    );
  }

  async function getLink(idParent: string, idJudoka: string): Promise<ParentLinkRow | null> {
    return supabaseSelectOne<ParentLinkRow>(
      "parent_judokas",
      `select=id_parent,id_judoka&${eqFilter("id_parent", idParent)}&${eqFilter("id_judoka", idJudoka)}`
    );
  }

  async function getOtherByJudoka(
    idJudoka: string,
    excludedParentId: string
  ): Promise<ParentLinkRow | null> {
    const links = await supabaseSelect<ParentLinkRow>(
      "parent_judokas",
      `select=id_parent,id_judoka&${eqFilter("id_judoka", idJudoka)}`
    );

    return links.find((link) => String(link.id_parent) !== String(excludedParentId)) || null;
  }

  async function insert(payload: ParentLinkRow): Promise<ParentLinkRow | null> {
    return supabaseInsert<ParentLinkRow>("parent_judokas", payload);
  }

  async function remove(idParent: string, idJudoka: string): Promise<void> {
    return supabaseDelete(
      "parent_judokas",
      `${eqFilter("id_parent", idParent)}&${eqFilter("id_judoka", idJudoka)}`
    );
  }

  return {
    getOtherByJudoka,
    getLink,
    insert,
    listByParent,
    remove
  };
}
