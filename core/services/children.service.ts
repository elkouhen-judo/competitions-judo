import { toCanonicalJudoka, toCanonicalManagedChild } from "./domain-adapters";
import type { createJudoka, createManagedChild, decideManagedChildRemoval, updateManagedChild } from "../domain/access/judoka";
import type { CombatsRepository } from "../repositories/combats.repository";
import type { CompetitionsRepository } from "../repositories/competitions.repository";
import type { JudokasRepository } from "../repositories/judokas.repository";
import type { ParentLinksRepository } from "../repositories/parent-links.repository";
import type { RpcMethods } from "../types";
import type { UserContextService } from "./user-context.service";

type ChildrenMethods = Pick<
  RpcMethods,
  "deleteManagedChild" | "getChildrenManagement" | "saveManagedChild"
>;

export interface ChildrenServiceDeps {
  combatsRepository: CombatsRepository;
  competitionsRepository: CompetitionsRepository;
  judokasRepository: JudokasRepository;
  parentLinksRepository: ParentLinksRepository;
  userContextService: UserContextService;
  assertCanManageChildrenProfile: (
    user: ReturnType<typeof toCanonicalJudoka> | null | undefined
  ) => void;
  buildJudokaId: () => string;
  cleanText: (value: unknown) => string;
  createManagedChild: typeof createManagedChild;
  createJudoka: typeof createJudoka;
  decideManagedChildRemoval: typeof decideManagedChildRemoval;
  isParent: (user: ReturnType<typeof toCanonicalJudoka> | null | undefined) => boolean;
  updateManagedChild: typeof updateManagedChild;
}

export interface ChildrenService {
  methods: ChildrenMethods;
}

export default function createChildrenService(deps: ChildrenServiceDeps): ChildrenService {
  const {
    combatsRepository,
    competitionsRepository,
    judokasRepository,
    parentLinksRepository,
    userContextService,
    assertCanManageChildrenProfile,
    buildJudokaId,
    cleanText,
    createManagedChild,
    createJudoka,
    decideManagedChildRemoval,
    isParent,
    updateManagedChild
  } = deps;

  async function getChildrenManagement(email: string) {
    const user = await userContextService.getCurrentUser(email);
    if (!user) {
      throw new Error(`Accès refusé pour : ${email}`);
    }
    const domainUser = toCanonicalJudoka(user);
    assertCanManageChildrenProfile(domainUser);

    return {
      user: toCanonicalJudoka(user),
      isParent: isParent(domainUser),
      children: (await userContextService.getParentManagedJudokas(user.id_judoka)).map(
        toCanonicalJudoka
      )
    };
  }

  async function saveManagedChild(email: string, child: object) {
    const user = await userContextService.getCurrentUser(email);
    if (!user) {
      throw new Error(`Accès refusé pour : ${email}`);
    }
    assertCanManageChildrenProfile(toCanonicalJudoka(user));

    const childInput = toCanonicalManagedChild(child);
    const firstName = cleanText(childInput.firstName);
    const lastName = cleanText(childInput.lastName);

    if (childInput.judokaId) {
      const childJudokaId = childInput.judokaId;
      const existingChild = await userContextService.getManagedChild(user.id_judoka, childJudokaId);
      if (!existingChild) {
        throw new Error("Enfant introuvable.");
      }

      const updatedChild = updateManagedChild({
        ...childInput,
        firstName,
        lastName
      });
      await userContextService.assertJudokaEmailAvailable(updatedChild.accountEmail, childJudokaId);
      await judokasRepository.updateManagedChild(childJudokaId, updatedChild);

      return {
        success: true,
        judokaId: childJudokaId,
        message: "Enfant modifié."
      };
    }

    const idJudoka = buildJudokaId();
    const managedChild = createManagedChild({
      ...childInput,
      judokaId: idJudoka,
      firstName,
      lastName
    });
    await userContextService.assertJudokaEmailAvailable(managedChild.accountEmail, idJudoka);
    await judokasRepository.insert(managedChild, {
      categorie_age: childInput.ageCategory ?? ""
    });
    await parentLinksRepository.insert({
      id_parent: user.id_judoka,
      id_judoka: idJudoka
    });

    return {
      success: true,
      judokaId: idJudoka,
      message: "Enfant ajouté."
    };
  }

  async function deleteManagedChild(email: string, idJudoka: string) {
    const user = await userContextService.getCurrentUser(email);
    if (!user) {
      throw new Error(`Accès refusé pour : ${email}`);
    }
    assertCanManageChildrenProfile(toCanonicalJudoka(user));

    if (!idJudoka) {
      throw new Error("Enfant obligatoire.");
    }

    const child = await userContextService.getManagedChild(user.id_judoka, idJudoka);
    if (!child) {
      throw new Error("Enfant introuvable.");
    }

    const competition = await competitionsRepository.existsForJudoka(idJudoka);
    const combat = await combatsRepository.existsForJudoka(idJudoka);
    const otherParentLink = await parentLinksRepository.getOtherByJudoka(idJudoka, user.id_judoka);
    const deletionDecision = decideManagedChildRemoval({
      child: createJudoka(toCanonicalJudoka(child)),
      hasCompetitions: Boolean(competition),
      hasCombats: Boolean(combat),
      hasOtherParentLink: Boolean(otherParentLink)
    });

    await parentLinksRepository.remove(user.id_judoka, idJudoka);

    if (deletionDecision.removeJudoka) {
      await judokasRepository.remove(idJudoka);
    }
    return {
      success: true,
      message: deletionDecision.message
    };
  }

  return {
    methods: {
      deleteManagedChild,
      getChildrenManagement,
      saveManagedChild
    }
  };
}
