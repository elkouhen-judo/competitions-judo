import type { ParentLinkRow, SupabaseRestDeps } from "./types";

export interface ParentLinksRepository {
  getLink(idParent: unknown, idJudoka: unknown): Promise<ParentLinkRow | null>;
  getOtherByJudoka(idJudoka: unknown, excludedParentId: unknown): Promise<ParentLinkRow | null>;
  insert(payload: ParentLinkRow): Promise<ParentLinkRow | null>;
  listByParent(idParent: unknown): Promise<Pick<ParentLinkRow, "id_judoka">[]>;
  remove(idParent: unknown, idJudoka: unknown): Promise<void>;
}

export default function createParentLinksRepository(deps: SupabaseRestDeps): ParentLinksRepository {
  const { supabaseDelete, supabaseInsert, supabaseSelect, supabaseSelectOne, eqFilter } = deps;

  async function listByParent(idParent: unknown): Promise<Pick<ParentLinkRow, "id_judoka">[]> {
    return supabaseSelect<Pick<ParentLinkRow, "id_judoka">>(
      "parent_judokas",
      `select=id_judoka&${eqFilter("id_parent", idParent)}`
    );
  }

  async function getLink(idParent: unknown, idJudoka: unknown): Promise<ParentLinkRow | null> {
    return supabaseSelectOne<ParentLinkRow>(
      "parent_judokas",
      `select=id_parent,id_judoka&${eqFilter("id_parent", idParent)}&${eqFilter("id_judoka", idJudoka)}`
    );
  }

  async function getOtherByJudoka(
    idJudoka: unknown,
    excludedParentId: unknown
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

  async function remove(idParent: unknown, idJudoka: unknown): Promise<void> {
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
