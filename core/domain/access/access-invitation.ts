import { createEmail } from "./email";
import { createProfileType, type ProfileType } from "./profile-type";

export interface AccessInvitationInput {
  email?: unknown;
  invited_profile_type?: unknown;
  invited_by?: unknown;
}

export interface AccessInvitationRecord {
  email: string;
  invited_profile_type: ProfileType;
  invited_by: unknown;
}

export function createAccessInvitation({
  email,
  invited_profile_type,
  invited_by
}: AccessInvitationInput): AccessInvitationRecord {
  const record = {
    email: createEmail(email, "Email d'invitation invalide.", "Email d'invitation obligatoire."),
    invited_profile_type: createProfileType(invited_profile_type),
    invited_by
  };

  return {
    ...record
  };
}
