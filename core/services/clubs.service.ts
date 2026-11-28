import { getJudokaClubIds, toCanonicalJudoka } from "./domain-adapters";
import type { ClubsRepository } from "../repositories/clubs.repository";
import type { ClubCompetitionsRepository } from "../repositories/club-competitions.repository";
import type { JudokasRepository } from "../repositories/judokas.repository";
import type { UserContextService } from "./user-context.service";
import type { ClubsManagement, OperationResult, RpcMethods } from "../types";

type ClubMethods = Pick<
  RpcMethods,
  | "getClubsManagement"
  | "saveClub"
  | "deleteClub"
  | "setCoachClubs"
  | "setJudokaClubs"
  | "addClubAdmin"
  | "removeClubAdmin"
>;

export interface ClubsServiceDeps {
  clubsRepository: ClubsRepository;
  clubCompetitionsRepository: Pick<ClubCompetitionsRepository, "countByClub">;
  judokasRepository: Pick<
    JudokasRepository,
    "getById" | "getByEmail" | "listByIds" | "listCoaches" | "countByClub" | "setClubs"
  >;
  userContextService: Pick<UserContextService, "getIdentity">;
  isAdmin: (user: ReturnType<typeof toCanonicalJudoka> | null | undefined) => boolean;
  buildClubId: () => string;
}

export interface ClubsService {
  methods: ClubMethods;
}

export function normalizeClubName(value: unknown): string {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function sameClubName(a: unknown, b: unknown): boolean {
  return normalizeClubName(a).toLocaleLowerCase("fr") === normalizeClubName(b).toLocaleLowerCase("fr");
}

export default function createClubsService(deps: ClubsServiceDeps): ClubsService {
  const {
    clubsRepository,
    clubCompetitionsRepository,
    judokasRepository,
    userContextService,
    isAdmin,
    buildClubId
  } = deps;

  async function requireAdmin(email: string): Promise<void> {
    const scope = await requireClubManager(email);
    if (!scope.isGlobalAdmin) {
      throw new Error("Action réservée à l'admin global.");
    }
  }

  // CLUBADM-001 : l'admin global gère tous les clubs, un admin de club les siens.
  // Le contrôle d'accès ne lit que le compte, pas les judokas du périmètre.
  async function requireClubManager(email: string): Promise<{ isGlobalAdmin: boolean; clubIds: string[] }> {
    const identity = await userContextService.getIdentity(email);
    if (!identity) {
      throw new Error(`Accès refusé pour : ${email}`);
    }
    const isGlobalAdmin = isAdmin(toCanonicalJudoka(identity.user));
    const clubIds = identity.adminClubIds || [];
    if (!isGlobalAdmin && !clubIds.length) {
      throw new Error("Gestion des clubs réservée aux admins.");
    }
    return { isGlobalAdmin, clubIds };
  }

  async function requireClub(idClub: unknown) {
    const id = String(idClub || "").trim();
    const club = id ? await clubsRepository.getById(id) : null;
    if (!club) {
      throw new Error("Club introuvable.");
    }
    return club;
  }

  async function getClubsManagement(email: string): Promise<ClubsManagement> {
    const scope = await requireClubManager(email);
    // PAGE-3 : seuls les coachs sont lus ; l'effectif de chaque club est compté par la base.
    const [clubs, links, coachRows, adminLinks] = await Promise.all([
      scope.isGlobalAdmin ? clubsRepository.listAll() : clubsRepository.listByIds(scope.clubIds),
      clubsRepository.listCoachLinks(),
      judokasRepository.listCoaches(),
      scope.isGlobalAdmin ? clubsRepository.listAdminLinks() : clubsRepository.listAdminLinks(scope.clubIds)
    ]);
    const clubIds = new Set(clubs.map((club) => String(club.id_club)));
    const clubLinks = links.filter((link) => clubIds.has(String(link.id_club)));
    const coachIds = new Set(clubLinks.map((link) => String(link.id_coach)));
    const [judokaCounts, adminRows] = await Promise.all([
      Promise.all(clubs.map((club) => judokasRepository.countByClub(club.id_club))),
      judokasRepository.listByIds([...new Set(adminLinks.map((link) => String(link.id_admin)))])
    ]);
    // Un admin de club ne voit que les coachs de ses clubs.
    const coaches = coachRows
      .map(toCanonicalJudoka)
      .filter((coach) => scope.isGlobalAdmin || coachIds.has(String(coach.judokaId)));
    return {
      isGlobalAdmin: scope.isGlobalAdmin,
      clubs: clubs.map((club, index) => ({
        clubId: club.id_club,
        name: club.nom,
        coachIds: clubLinks
          .filter((link) => String(link.id_club) === String(club.id_club))
          .map((link) => String(link.id_coach)),
        judokaCount: judokaCounts[index] || 0,
        adminIds: adminLinks
          .filter((link) => String(link.id_club) === String(club.id_club))
          .map((link) => String(link.id_admin))
      })),
      coaches: coaches.map(toPersonSummary),
      clubAdmins: adminRows.map(toCanonicalJudoka).map(toPersonSummary)
    };
  }

  function toPersonSummary(person: ReturnType<typeof toCanonicalJudoka>) {
    return {
      judokaId: person.judokaId,
      firstName: person.firstName,
      lastName: person.lastName,
      accountEmail: person.accountEmail
    };
  }

  async function saveClub(email: string, input: { clubId?: string; name?: string }): Promise<OperationResult> {
    const scope = await requireClubManager(email);
    const clubId = String((input && input.clubId) || "").trim();
    // CLUBADM-005 : un admin de club renomme ses clubs ; seul l'admin global en crée.
    if (!scope.isGlobalAdmin && (!clubId || !scope.clubIds.includes(clubId))) {
      throw new Error(clubId ? "Club hors de vos clubs." : "Action réservée à l'admin global.");
    }
    const name = normalizeClubName(input && input.name);
    if (!name) {
      throw new Error("Nom du club obligatoire.");
    }
    const clubs = await clubsRepository.listAll();
    if (clubs.some((club) => sameClubName(club.nom, name) && String(club.id_club) !== clubId)) {
      throw new Error("Un club porte déjà ce nom.");
    }
    if (clubId) {
      await requireClub(clubId);
      await clubsRepository.rename(clubId, name);
      return { success: true, message: "Club renommé." };
    }
    await clubsRepository.insert({ id_club: buildClubId(), nom: name });
    return { success: true, message: "Club créé." };
  }

  async function deleteClub(email: string, idClub: string): Promise<OperationResult> {
    await requireAdmin(email);
    const club = await requireClub(idClub);
    const [judokaCount, competitionCount, links] = await Promise.all([
      judokasRepository.countByClub(club.id_club),
      clubCompetitionsRepository.countByClub(club.id_club),
      clubsRepository.listCoachLinks()
    ]);
    const coachCount = links.filter((link) => String(link.id_club) === String(club.id_club)).length;
    if (judokaCount || competitionCount || coachCount) {
      throw new Error("Seul un club sans judoka, sans coach et sans compétition peut être supprimé.");
    }
    await clubsRepository.remove(club.id_club);
    return { success: true, message: "Club supprimé." };
  }

  async function setCoachClubs(email: string, idCoach: string, clubIds: string[]): Promise<OperationResult> {
    await requireAdmin(email);
    const coach = await judokasRepository.getById(String(idCoach || ""));
    if (!coach || toCanonicalJudoka(coach).accessRole !== "COACH") {
      throw new Error("Coach introuvable.");
    }
    const ids = [...new Set((clubIds || []).map((id) => String(id || "").trim()).filter(Boolean))];
    for (const id of ids) {
      await requireClub(id);
    }
    await clubsRepository.replaceCoachClubs(coach.id_judoka, ids);
    return { success: true, message: "Clubs du coach mis à jour." };
  }

  // CLUB-001 : les structures d'un judoka (club, pôle espoir…) et son club principal, choisi parmi elles.
  async function setJudokaClubs(
    email: string,
    idJudoka: string,
    clubIds: string[],
    mainClubId?: string | null
  ): Promise<OperationResult> {
    const scope = await requireClubManager(email);
    const judoka = await judokasRepository.getById(String(idJudoka || ""));
    if (!judoka) {
      throw new Error("Judoka introuvable.");
    }
    let ids = [...new Set((clubIds || []).map((id) => String(id || "").trim()).filter(Boolean))];
    let requestedMain = String(mainClubId || "").trim();
    const current = getJudokaClubIds(judoka).map(String);
    const currentMain = String(judoka.club_id || "") || current[0] || "";
    if (!scope.isGlobalAdmin) {
      // CLUBADM-009 : un admin de club ne retire pas un admin global de ses clubs.
      if (isAdmin(toCanonicalJudoka(judoka))) {
        throw new Error("Ce compte est admin global : seul un admin global peut changer ses clubs.");
      }
      // CLUBADM-006 : un admin de club ne change que ses clubs ; les autres clubs du judoka et
      // un club principal situé ailleurs restent tels quels.
      if (!current.some((id) => scope.clubIds.includes(id))) {
        throw new Error("Profil hors de vos clubs.");
      }
      const kept = current.filter((id) => !scope.clubIds.includes(id));
      ids = [...new Set([...kept, ...ids.filter((id) => scope.clubIds.includes(id))])];
      // Retirer le club principal ferait d'une seconde structure le club du judoka à son insu.
      if (currentMain && scope.clubIds.includes(currentMain) && !ids.includes(currentMain) && ids.length) {
        throw new Error("Ce judoka a aussi une autre structure : demandez à l'admin global de changer son club.");
      }
      if (currentMain && !scope.clubIds.includes(currentMain) && ids.includes(currentMain)) {
        requestedMain = currentMain;
      } else if (requestedMain && !scope.clubIds.includes(requestedMain)) {
        requestedMain = "";
      }
    }
    for (const id of ids) {
      await requireClub(id);
    }
    if (requestedMain && !ids.includes(requestedMain)) {
      throw new Error("Le club principal doit faire partie des clubs du judoka.");
    }
    const main = requestedMain || (ids.includes(currentMain) ? currentMain : ids[0]) || null;
    // CLUBADM-008 : un judoka n'est inscrit directement que dans un club. Seul l'admin global
    // l'inscrit dans un nouveau club, qui devient son club principal à la place de l'ancien ;
    // une seconde structure ne s'ajoute que par une demande acceptée.
    const added = ids.filter((id) => !current.includes(id));
    const isClubChange =
      scope.isGlobalAdmin && added.length === 1 && added[0] === main && !(currentMain && ids.includes(currentMain));
    if (added.length && !isClubChange) {
      throw new Error(
        "Une seconde structure s'ajoute par une demande du judoka, acceptée par un admin de cette structure."
      );
    }
    await judokasRepository.setClubs(judoka.id_judoka, ids, main);
    return {
      success: true,
      message: isClubChange ? "Club du judoka changé." : ids.length ? "Clubs du judoka mis à jour." : "Judoka retiré de ses clubs."
    };
  }

  // CLUBADM-001 : l'admin global nomme les admins d'un club, par l'e-mail de leur compte.
  async function addClubAdmin(email: string, idClub: string, targetEmail: string): Promise<OperationResult> {
    await requireAdmin(email);
    const club = await requireClub(idClub);
    const target = await judokasRepository.getByEmail(String(targetEmail || "").trim().toLowerCase());
    if (!target || !String(target.email || "").trim()) {
      throw new Error("Aucun compte trouvé avec cet e-mail.");
    }
    const links = await clubsRepository.listAdminLinks([club.id_club]);
    if (links.some((link) => String(link.id_admin) === String(target.id_judoka))) {
      throw new Error("Ce compte administre déjà ce club.");
    }
    await clubsRepository.addClubAdmin(target.id_judoka, club.id_club);
    return { success: true, message: `Admin du club ${club.nom} ajouté.` };
  }

  async function removeClubAdmin(email: string, idClub: string, idAdmin: string): Promise<OperationResult> {
    await requireAdmin(email);
    const club = await requireClub(idClub);
    const links = await clubsRepository.listAdminLinks([club.id_club]);
    if (!links.some((link) => String(link.id_admin) === String(idAdmin || ""))) {
      throw new Error("Admin du club introuvable.");
    }
    await clubsRepository.removeClubAdmin(String(idAdmin), club.id_club);
    return { success: true, message: `Admin du club ${club.nom} retiré.` };
  }

  return {
    methods: {
      getClubsManagement,
      saveClub,
      deleteClub,
      setCoachClubs,
      setJudokaClubs,
      addClubAdmin,
      removeClubAdmin
    }
  };
}
