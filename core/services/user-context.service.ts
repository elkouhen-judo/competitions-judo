import { toCanonicalJudoka } from "./domain-adapters";
import type { JudokaIdentity, JudokaRow } from "../repositories/types";
import type { JudokasRepository } from "../repositories/judokas.repository";
import type { DomainUserContext, ManagedJudokaScope, UserContext } from "../types";

export interface UserContextServiceDeps {
  judokasRepository: Pick<
    JudokasRepository,
    "getIdentityByEmail" | "getById" | "listAll" | "listByIds" | "listByClubIds"
  >;
  /** Mémorise une lecture pour la durée d'un appel RPC (CTX-1). Par défaut : aucune mémoire. */
  memoizeInRequest?: <T>(key: string, load: () => Promise<T>) => Promise<T>;
  normalizeEmail: (value: unknown) => string;
  assertCanAccessJudokaProfile: (
    user: ReturnType<typeof toCanonicalJudoka> | null | undefined,
    idJudoka: string,
    managedJudokaScope: ManagedJudokaScope | null | undefined
  ) => void;
  createManagedJudokaScope: (judokaIds: string[]) => ManagedJudokaScope;
  isAdmin: (user: ReturnType<typeof toCanonicalJudoka> | null | undefined) => boolean;
  isCoach: (user: ReturnType<typeof toCanonicalJudoka> | null | undefined) => boolean;
  isParent: (user: ReturnType<typeof toCanonicalJudoka> | null | undefined) => boolean;
}

export interface UserContextService {
  getAccessibleJudokaProfile(
    email: string,
    idJudoka?: string
  ): Promise<{ user: JudokaRow; target: JudokaRow }>;
  getCurrentUser(email: string): Promise<JudokaRow | null>;
  /** Le compte et ses liens (clubs coachés, enfants), sans charger les judokas du périmètre. */
  getIdentity(email: string): Promise<JudokaIdentity | null>;
  getCurrentUserContext(email: string): Promise<UserContext>;
  getDomainUserContext(email: string): Promise<DomainUserContext>;
  getJudokaById(idJudoka: string): Promise<JudokaRow | null>;
}

export default function createUserContextService(
  deps: UserContextServiceDeps
): UserContextService {
  const {
    judokasRepository,
    memoizeInRequest = <T>(_key: string, load: () => Promise<T>) => load(),
    normalizeEmail,
    assertCanAccessJudokaProfile,
    createManagedJudokaScope,
    isAdmin,
    isCoach,
    isParent
  } = deps;

  async function getIdentity(email: string): Promise<JudokaIdentity | null> {
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) {
      return null;
    }

    return memoizeInRequest(`identity:${normalizedEmail}`, () =>
      judokasRepository.getIdentityByEmail(normalizedEmail)
    );
  }

  async function getCurrentUser(email: string): Promise<JudokaRow | null> {
    const identity = await getIdentity(email);
    return identity ? identity.user : null;
  }

  async function getJudokaById(idJudoka: string): Promise<JudokaRow | null> {
    return judokasRepository.getById(idJudoka);
  }

  // CTX-1 : le contexte coûte 2 requêtes au plus (compte et liens, puis judokas du périmètre)
  // et n'est calculé qu'une fois par appel RPC.
  async function getCurrentUserContext(email: string): Promise<UserContext> {
    return memoizeInRequest(`context:${normalizeEmail(email)}`, () => loadCurrentUserContext(email));
  }

  async function loadCurrentUserContext(email: string): Promise<UserContext> {
    const identity = await getIdentity(email);

    if (!identity) {
      throw new Error(`Accès refusé pour : ${email}`);
    }

    const { user } = identity;
    let judokas: JudokaRow[] = [];
    let managedJudokaScope = createManagedJudokaScope([]);
    let coachClubIds: string[] = [];
    const domainUser = toCanonicalJudoka(user);

    if (isCoach(domainUser)) {
      // Un coach ne voit que les judokas des clubs qu'il coache (et son propre profil).
      coachClubIds = identity.coachClubIds;
      const clubJudokas = await judokasRepository.listByClubIds(coachClubIds);
      const includesSelf = clubJudokas.some((j) => String(j.id_judoka) === String(user.id_judoka));
      judokas = includesSelf ? clubJudokas : [user, ...clubJudokas];
      managedJudokaScope = createManagedJudokaScope(judokas.map((j) => String(j.id_judoka)));
    } else if (isAdmin(domainUser)) {
      judokas = await judokasRepository.listAll();
    } else if (isParent(domainUser)) {
      const children = await judokasRepository.listByIds(identity.childJudokaIds);
      const alreadyIncluded = children.some((j) => String(j.id_judoka) === String(user.id_judoka));
      judokas = alreadyIncluded ? children : [user, ...children];
      const managedJudokaIds = judokas.map((j) => String(j.id_judoka));
      managedJudokaScope = createManagedJudokaScope(managedJudokaIds);
    }

    return { user, judokas, managedJudokaScope, coachClubIds };
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
    getAccessibleJudokaProfile,
    getCurrentUser,
    getCurrentUserContext,
    getDomainUserContext,
    getIdentity,
    getJudokaById
  };
}
