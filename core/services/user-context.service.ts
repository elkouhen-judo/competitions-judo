import { toCanonicalJudoka } from "./domain-adapters";
import type { JudokaRow } from "../repositories/types";
import type { JudokasRepository } from "../repositories/judokas.repository";
import type { ParentLinksRepository } from "../repositories/parent-links.repository";
import type { DomainUserContext, ManagedJudokaScope, UserContext } from "../types";

export interface UserContextServiceDeps {
  judokasRepository: JudokasRepository;
  parentLinksRepository: ParentLinksRepository;
  normalizeEmail: (value: unknown) => string;
  assertCanAccessJudokaProfile: (
    user: ReturnType<typeof toCanonicalJudoka> | null | undefined,
    idJudoka: unknown,
    managedJudokaScope: ManagedJudokaScope | null | undefined
  ) => void;
  createManagedJudokaScope: (judokaIds: unknown[]) => ManagedJudokaScope;
  isAdmin: (user: ReturnType<typeof toCanonicalJudoka> | null | undefined) => boolean;
  isCoach: (user: ReturnType<typeof toCanonicalJudoka> | null | undefined) => boolean;
  isParent: (user: ReturnType<typeof toCanonicalJudoka> | null | undefined) => boolean;
}

export interface UserContextService {
  assertJudokaEmailAvailable(email: string | null | undefined, currentIdJudoka?: unknown): Promise<void>;
  getAccessibleJudokaProfile(
    email: string,
    idJudoka?: string
  ): Promise<{ user: JudokaRow; target: JudokaRow }>;
  getCurrentUser(email: string): Promise<JudokaRow | null>;
  getCurrentUserContext(email: string): Promise<UserContext>;
  getDomainUserContext(email: string): Promise<DomainUserContext>;
  getJudokaById(idJudoka: unknown): Promise<JudokaRow | null>;
  getJudokas(): Promise<JudokaRow[]>;
  getManagedChild(idParent: unknown, idJudoka: unknown): Promise<JudokaRow | null>;
  getParentManagedJudokas(idParent: unknown): Promise<JudokaRow[]>;
}

export default function createUserContextService(
  deps: UserContextServiceDeps
): UserContextService {
  const {
    judokasRepository,
    parentLinksRepository,
    normalizeEmail,
    assertCanAccessJudokaProfile,
    createManagedJudokaScope,
    isAdmin,
    isCoach,
    isParent
  } = deps;

  async function getCurrentUser(email: string): Promise<JudokaRow | null> {
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) {
      return null;
    }

    return judokasRepository.getByEmail(normalizedEmail);
  }

  async function getJudokas(): Promise<JudokaRow[]> {
    return judokasRepository.listAll();
  }

  async function getJudokaById(idJudoka: unknown): Promise<JudokaRow | null> {
    return judokasRepository.getById(idJudoka);
  }

  async function getParentManagedJudokas(idParent: unknown): Promise<JudokaRow[]> {
    const rows = await parentLinksRepository.listByParent(idParent);
    if (!rows.length) {
      return [];
    }

    const ids = rows.map((row) => row.id_judoka);
    return judokasRepository.listByIds(ids);
  }

  async function getManagedChild(idParent: unknown, idJudoka: unknown): Promise<JudokaRow | null> {
    const link = await parentLinksRepository.getLink(idParent, idJudoka);
    if (!link) {
      return null;
    }

    return getJudokaById(idJudoka);
  }

  async function assertJudokaEmailAvailable(
    email: string | null | undefined,
    currentIdJudoka?: unknown
  ): Promise<void> {
    if (!email) {
      return;
    }

    const existingUser = await getCurrentUser(email);
    if (existingUser && String(existingUser.id_judoka) !== String(currentIdJudoka || "")) {
      throw new Error("Un autre profil utilise déjà cet email.");
    }
  }

  async function getCurrentUserContext(email: string): Promise<UserContext> {
    const user = await getCurrentUser(email);

    if (!user) {
      throw new Error(`Accès refusé pour : ${email}`);
    }

    let judokas: JudokaRow[] = [];
    let managedJudokaScope = createManagedJudokaScope([]);
    const domainUser = toCanonicalJudoka(user);

    if (isAdmin(domainUser) || isCoach(domainUser)) {
      judokas = await getJudokas();
    } else if (isParent(domainUser)) {
      const children = await getParentManagedJudokas(user.id_judoka);
      const alreadyIncluded = children.some((j) => String(j.id_judoka) === String(user.id_judoka));
      judokas = alreadyIncluded ? children : [user, ...children];
      const managedJudokaIds = judokas.map((j) => String(j.id_judoka));
      managedJudokaScope = createManagedJudokaScope(managedJudokaIds);
    }

    return { user, judokas, managedJudokaScope };
  }

  async function getDomainUserContext(email: string): Promise<DomainUserContext> {
    const userContext = await getCurrentUserContext(email);

    return {
      ...userContext,
      domainUser: toCanonicalJudoka(userContext.user)
    };
  }

  async function getAccessibleJudokaProfile(
    email: string,
    idJudoka?: string
  ): Promise<{ user: JudokaRow; target: JudokaRow }> {
    const userContext = await getCurrentUserContext(email);
    const { user } = userContext;
    const targetId = idJudoka || user.id_judoka;
    const target = await getJudokaById(targetId);

    if (!target) {
      throw new Error("Judoka introuvable.");
    }

    assertCanAccessJudokaProfile(toCanonicalJudoka(user), targetId, userContext.managedJudokaScope);
    return { user, target };
  }

  return {
    assertJudokaEmailAvailable,
    getAccessibleJudokaProfile,
    getCurrentUser,
    getCurrentUserContext,
    getDomainUserContext,
    getJudokaById,
    getJudokas,
    getManagedChild,
    getParentManagedJudokas
  };
}
