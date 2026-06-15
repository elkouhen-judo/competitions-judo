import type { AccessInvitationRecord } from "../domain/access/access-invitation";
import type { AccessInvitationRow, SupabaseRestDeps } from "./types";

export interface InvitationsRepository {
  getByEmail(email: string): Promise<AccessInvitationRow | null>;
  insert(invitation: AccessInvitationRecord): Promise<AccessInvitationRow | null>;
  listAll(): Promise<AccessInvitationRow[]>;
  removeByEmail(email: string): Promise<void>;
}

function toAccessInvitationRecord(invitation: AccessInvitationRecord): Record<string, unknown> {
  return {
    email: invitation.email,
    invited_profile_type: invitation.invited_profile_type,
    invited_by: invitation.invited_by
  };
}

function findEmailQueryValue(email: string): string {
  return encodeURIComponent(String(email || "").trim());
}

export default function createInvitationsRepository(deps: SupabaseRestDeps): InvitationsRepository {
  const { supabaseDelete, supabaseInsert, supabaseSelect, supabaseSelectOne } = deps;

  async function getByEmail(email: string): Promise<AccessInvitationRow | null> {
    return supabaseSelectOne<AccessInvitationRow>(
      "access_invitations",
      `select=*&email=ilike.${findEmailQueryValue(email)}`
    );
  }

  async function listAll(): Promise<AccessInvitationRow[]> {
    return supabaseSelect<AccessInvitationRow>(
      "access_invitations",
      "select=*&order=created_at.desc,email.asc"
    );
  }

  async function insert(
    invitation: AccessInvitationRecord
  ): Promise<AccessInvitationRow | null> {
    return supabaseInsert<AccessInvitationRow>(
      "access_invitations",
      toAccessInvitationRecord(invitation)
    );
  }

  async function removeByEmail(email: string): Promise<void> {
    return supabaseDelete(
      "access_invitations",
      `email=ilike.${findEmailQueryValue(email)}`
    );
  }

  return {
    getByEmail,
    insert,
    listAll,
    removeByEmail
  };
}
