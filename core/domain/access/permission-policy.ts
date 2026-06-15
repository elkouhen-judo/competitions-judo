import { isParentProfileType } from "./profile-type";
import { isAdminRole, isCoachRole } from "./role";
import type { ManagedJudokaScope } from "../../types";

export interface UserLike {
  accessRole?: unknown;
  profileType?: unknown;
  judokaId?: unknown;
}

export interface CompetitionLike {
  ownerJudokaId?: unknown;
}

export type AccessScopeKind = "ALL" | "MANAGED" | "OWN";

export interface AccessScope {
  kind: AccessScopeKind;
  judokaId: string;
  managedJudokaScope: ManagedJudokaScope | undefined;
  isAll(): boolean;
  isManaged(): boolean;
  isOwn(): boolean;
  canManageJudoka(targetJudokaId: unknown): boolean;
  canManageCompetition(competition: CompetitionLike | null | undefined): boolean;
  visibleJudokaIds(): string[] | null;
}

export function isAdmin(user: UserLike | null | undefined): boolean {
  return isAdminRole(user && user.accessRole);
}

export function isCoach(user: UserLike | null | undefined): boolean {
  return isCoachRole(user && user.accessRole);
}

export function hasClubReadAccess(user: UserLike | null | undefined): boolean {
  return isAdmin(user) || isCoach(user);
}

export function isParent(user: UserLike | null | undefined): boolean {
  return isParentProfileType(user && user.profileType);
}

export function canManageChildrenProfile(user: UserLike | null | undefined): boolean {
  return isParent(user);
}

export function canManageClubCompetition(user: UserLike | null | undefined): boolean {
  return isAdmin(user) || isCoach(user);
}

export function assertCanManageChildrenProfile(user: UserLike | null | undefined): void {
  if (!canManageChildrenProfile(user)) {
    throw new Error("Gestion des enfants non disponible pour ce profil.");
  }
}

function getUserJudokaId(user: UserLike | null | undefined): unknown {
  return user && user.judokaId;
}

function getCompetitionOwnerJudokaId(competition: CompetitionLike | null | undefined): unknown {
  return competition && competition.ownerJudokaId;
}

function isInManagedScope(
  managedJudokaScope: ManagedJudokaScope | null | undefined,
  idJudoka: unknown
): boolean {
  return Boolean(managedJudokaScope && managedJudokaScope.includes(idJudoka));
}

export function createAccessScope(
  kind: AccessScopeKind,
  options: { judokaId?: unknown; managedJudokaScope?: ManagedJudokaScope | undefined } = {}
): AccessScope {
  const judokaId = String(options.judokaId || "");
  const managedJudokaScope = options.managedJudokaScope;

  return {
    kind,
    judokaId,
    managedJudokaScope,
    isAll() {
      return kind === "ALL";
    },
    isManaged() {
      return kind === "MANAGED";
    },
    isOwn() {
      return kind === "OWN";
    },
    canManageJudoka(targetJudokaId: unknown) {
      if (this.isAll()) return true;
      if (this.isManaged()) return isInManagedScope(managedJudokaScope, targetJudokaId);
      return String(judokaId) === String(targetJudokaId);
    },
    canManageCompetition(competition: CompetitionLike | null | undefined) {
      return this.canManageJudoka(getCompetitionOwnerJudokaId(competition));
    },
    visibleJudokaIds() {
      if (this.isAll()) return null;
      if (this.isManaged()) return managedJudokaScope ? managedJudokaScope.toIds() : [];
      return [judokaId];
    }
  };
}

export function resolveJudokaDataAccess(
  user: UserLike | null | undefined,
  managedJudokaScope: ManagedJudokaScope | undefined
): AccessScope {
  if (hasClubReadAccess(user)) {
    return createAccessScope("ALL");
  }

  if (isParent(user)) {
    return createAccessScope("MANAGED", { managedJudokaScope });
  }

  return createAccessScope("OWN", { judokaId: getUserJudokaId(user) });
}

export function canManageCombatFor(
  user: UserLike | null | undefined,
  idJudoka: unknown,
  managedJudokaScope: ManagedJudokaScope | null | undefined
): boolean {
  if (isAdmin(user) || isCoach(user)) return true;
  if (isParent(user)) {
    return isInManagedScope(managedJudokaScope, idJudoka);
  }
  return String(getUserJudokaId(user)) === String(idJudoka);
}

export function assertCanManageCombatFor(
  user: UserLike | null | undefined,
  idJudoka: unknown,
  managedJudokaScope: ManagedJudokaScope | null | undefined,
  message: string
): void {
  if (!canManageCombatFor(user, idJudoka, managedJudokaScope)) {
    throw new Error(message);
  }
}

export function canManageCompetition(
  user: UserLike | null | undefined,
  competition: CompetitionLike | null | undefined,
  managedJudokaScope: ManagedJudokaScope | null | undefined
): boolean {
  const ownerJudokaId = getCompetitionOwnerJudokaId(competition);
  if (isAdmin(user) || isCoach(user)) return true;
  if (isParent(user)) {
    return isInManagedScope(managedJudokaScope, ownerJudokaId);
  }
  return String(getUserJudokaId(user)) === String(ownerJudokaId);
}

export function assertCanManageCompetition(
  user: UserLike | null | undefined,
  competition: CompetitionLike | null | undefined,
  managedJudokaScope: ManagedJudokaScope | null | undefined,
  message: string
): void {
  if (!canManageCompetition(user, competition, managedJudokaScope)) {
    throw new Error(message);
  }
}

export function canAccessJudokaProfile(
  user: UserLike | null | undefined,
  idJudoka: unknown,
  managedJudokaScope: ManagedJudokaScope | null | undefined
): boolean {
  if (hasClubReadAccess(user)) return true;
  if (isParent(user)) {
    return isInManagedScope(managedJudokaScope, idJudoka);
  }
  return String(getUserJudokaId(user)) === String(idJudoka);
}

export function assertCanAccessJudokaProfile(
  user: UserLike | null | undefined,
  idJudoka: unknown,
  managedJudokaScope: ManagedJudokaScope | null | undefined
): void {
  if (!canAccessJudokaProfile(user, idJudoka, managedJudokaScope)) {
    throw new Error("Accès refusé à cette fiche judoka.");
  }
}

export function canAccessCompetition(
  user: UserLike | null | undefined,
  competition: CompetitionLike | null | undefined,
  managedJudokaScope: ManagedJudokaScope | null | undefined
): boolean {
  const ownerJudokaId = getCompetitionOwnerJudokaId(competition);
  if (hasClubReadAccess(user)) return true;
  if (isParent(user)) {
    return isInManagedScope(managedJudokaScope, ownerJudokaId);
  }
  return String(getUserJudokaId(user)) === String(ownerJudokaId);
}

export function assertCanAccessCompetition(
  user: UserLike | null | undefined,
  competition: CompetitionLike | null | undefined,
  managedJudokaScope: ManagedJudokaScope | null | undefined,
  message: string
): void {
  if (!canAccessCompetition(user, competition, managedJudokaScope)) {
    throw new Error(message);
  }
}

export function resolveCompetitionOwnerId(
  user: UserLike | null | undefined,
  competition: CompetitionLike | null | undefined,
  managedJudokaScope: ManagedJudokaScope | null | undefined
): string {
  const ownerJudokaId = getCompetitionOwnerJudokaId(competition);

  if (isAdmin(user)) {
    if (!ownerJudokaId) throw new Error("Judoka participant obligatoire.");
    return String(ownerJudokaId);
  }

  if (isParent(user)) {
    if (!ownerJudokaId) throw new Error("Judoka participant obligatoire.");
    if (!isInManagedScope(managedJudokaScope, ownerJudokaId)) {
      throw new Error("Ce judoka n'est pas dans votre liste.");
    }
    return String(ownerJudokaId);
  }

  return String(getUserJudokaId(user) || "");
}
