import type { AdminService } from "./admin.service";
import type { createEmail } from "../domain/access/email";
import type { RpcMethods } from "../types";

type RegistrationMethods = Pick<RpcMethods, "registerProfile">;

export interface RegistrationProfileInput {
  firstName?: unknown;
  lastName?: unknown;
}

export interface RegistrationServiceDeps {
  adminService: AdminService;
  createEmail: typeof createEmail;
  supabaseRpc: (method: string, payload?: Record<string, unknown>) => Promise<object>;
}

export interface RegistrationService {
  methods: RegistrationMethods;
}

export default function createRegistrationService(
  deps: RegistrationServiceDeps
): RegistrationService {
  const { adminService, createEmail, supabaseRpc } = deps;

  async function registerProfile(email: string, profile: RegistrationProfileInput) {
    const invitation = await adminService.getAccessInvitation(email);
    if (!invitation) {
      throw new Error("Accès non autorisé. Une invitation est requise.");
    }

    return supabaseRpc("register_profile", {
      p_email: createEmail(email),
      p_type: invitation.invited_profile_type || "JUDOKA",
      p_prenom: profile && profile.firstName,
      p_nom: profile && profile.lastName,
      p_children: []
    });
  }

  return {
    methods: {
      registerProfile
    }
  };
}
