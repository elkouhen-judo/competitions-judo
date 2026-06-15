import { createOptionalEmail } from "./email";
import { createOptionalPersonName, createPersonName, type PersonName } from "./person-name";
import { createProfileType, type ProfileType } from "./profile-type";
import { createRole, type AccessRole } from "./role";
import { createJudokaId } from "../shared/identity";

export interface JudokaInput {
  name?: PersonName;
  judokaId?: unknown;
  accountEmail?: unknown;
  profileType?: unknown;
  accessRole?: unknown;
  firstName?: unknown;
  lastName?: unknown;
}

export interface JudokaModel {
  judokaId: unknown;
  accountEmail: string | null;
  name: PersonName;
  profileType: ProfileType;
  accessRole: AccessRole;
  hasDirectAccount(): boolean;
  isAdmin(): boolean;
  isCoach(): boolean;
  grantAdminRole(): { accessRole: AccessRole };
  revokeAdminRole(actorIdJudoka: unknown): { accessRole: AccessRole };
}

export interface ManagedChildInput {
  judokaId?: unknown;
  accountEmail?: unknown;
  name?: PersonName;
  firstName?: unknown;
  lastName?: unknown;
}

export interface UpdateManagedChildResult {
  accountEmail: string | null;
  name: PersonName;
}

export interface DecideManagedChildRemovalInput {
  child: JudokaInput;
  hasCompetitions: unknown;
  hasCombats: unknown;
  hasOtherParentLink: unknown;
}

export interface ManagedChildRemovalDecision {
  removeJudoka: boolean;
  message: string;
}

function normalizeOptionalEmail(email: unknown): string | null {
  return createOptionalEmail(email, "Email de l'enfant invalide.");
}

export function createJudoka(user: JudokaInput = {}): JudokaModel {
  const name = user.name || createOptionalPersonName(user);
  const judokaId = user.judokaId;
  const accountEmail = normalizeOptionalEmail(user.accountEmail);
  const profileType = createProfileType(user.profileType || "JUDOKA");
  const accessRole = createRole(user.accessRole || "NORMAL");
  const record = { judokaId, accountEmail, name, profileType, accessRole };

  return {
    ...record,
    hasDirectAccount() {
      return Boolean(record.accountEmail);
    },
    isAdmin() {
      return record.accessRole === "ADMIN";
    },
    isCoach() {
      return record.accessRole === "COACH";
    },
    grantAdminRole() {
      if (this.isAdmin()) {
        throw new Error("Cet utilisateur est déjà admin.");
      }

      return { accessRole: createRole("ADMIN") };
    },
    revokeAdminRole(actorIdJudoka: unknown) {
      if (!this.isAdmin()) {
        throw new Error("Admin introuvable.");
      }
      if (String(actorIdJudoka) === String(record.judokaId)) {
        throw new Error("Vous ne pouvez pas retirer vos propres droits admin.");
      }

      return { accessRole: createRole("NORMAL") };
    }
  };
}

export function createManagedChild({
  judokaId,
  accountEmail,
  name,
  firstName,
  lastName
}: ManagedChildInput): JudokaModel {
  const childName = name || createPersonName({ firstName, lastName });

  return createJudoka({
    judokaId: createJudokaId(judokaId),
    accountEmail,
    name: childName,
    profileType: "JUDOKA",
    accessRole: "NORMAL"
  });
}

export function updateManagedChild({
  accountEmail,
  name,
  firstName,
  lastName
}: ManagedChildInput): UpdateManagedChildResult {
  const childName = name || createPersonName({ firstName, lastName });
  const normalizedAccountEmail = normalizeOptionalEmail(accountEmail);

  return {
    accountEmail: normalizedAccountEmail,
    name: childName
  };
}

export function decideManagedChildRemoval({
  child,
  hasCompetitions,
  hasCombats,
  hasOtherParentLink
}: DecideManagedChildRemovalInput): ManagedChildRemovalDecision {
  const managedChild = createJudoka(child);

  if (hasCompetitions) {
    throw new Error("Impossible de supprimer cet enfant tant qu'il possède des compétitions.");
  }
  if (hasCombats) {
    throw new Error("Impossible de supprimer cet enfant tant qu'il possède des combats.");
  }

  const removeJudoka = !hasOtherParentLink && !managedChild.hasDirectAccount();
  return {
    removeJudoka,
    message: removeJudoka ? "Enfant supprimé." : "Enfant retiré."
  };
}
