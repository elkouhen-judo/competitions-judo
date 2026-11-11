import { toCanonicalJudoka } from "./domain-adapters";
import type { ClubsRepository } from "../repositories/clubs.repository";
import type { ClubCompetitionsRepository } from "../repositories/club-competitions.repository";
import type { JudokasRepository } from "../repositories/judokas.repository";
import type { UserContextService } from "./user-context.service";
import type { ClubsManagement, OperationResult, RpcMethods } from "../types";

type ClubMethods = Pick<
  RpcMethods,
  "getClubsManagement" | "saveClub" | "deleteClub" | "setCoachClubs" | "setJudokaClub"
>;

export interface ClubsServiceDeps {
  clubsRepository: ClubsRepository;
  clubCompetitionsRepository: Pick<ClubCompetitionsRepository, "countByClub">;
  judokasRepository: Pick<
    JudokasRepository,
    "getById" | "listAll" | "countByClub" | "setClub"
  >;
  userContextService: Pick<UserContextService, "getDomainUserContext">;
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
    const { domainUser } = await userContextService.getDomainUserContext(email);
    if (!isAdmin(domainUser)) {
      throw new Error("Gestion des clubs réservée aux admins.");
    }
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
    await requireAdmin(email);
    const [clubs, links, judokas] = await Promise.all([
      clubsRepository.listAll(),
      clubsRepository.listCoachLinks(),
      judokasRepository.listAll()
    ]);
    const coaches = judokas
      .map(toCanonicalJudoka)
      .filter((judoka) => judoka.accessRole === "COACH");
    return {
      clubs: clubs.map((club) => ({
        clubId: club.id_club,
        name: club.nom,
        coachIds: links
          .filter((link) => String(link.id_club) === String(club.id_club))
          .map((link) => String(link.id_coach)),
        judokaCount: judokas.filter((judoka) => String(judoka.club_id || "") === String(club.id_club)).length
      })),
      coaches: coaches.map((coach) => ({
        judokaId: coach.judokaId,
        firstName: coach.firstName,
        lastName: coach.lastName,
        accountEmail: coach.accountEmail
      }))
    };
  }

  async function saveClub(email: string, input: { clubId?: string; name?: string }): Promise<OperationResult> {
    await requireAdmin(email);
    const name = normalizeClubName(input && input.name);
    if (!name) {
      throw new Error("Nom du club obligatoire.");
    }
    const clubs = await clubsRepository.listAll();
    const clubId = String((input && input.clubId) || "").trim();
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

  async function setJudokaClub(email: string, idJudoka: string, idClub: string | null): Promise<OperationResult> {
    await requireAdmin(email);
    const judoka = await judokasRepository.getById(String(idJudoka || ""));
    if (!judoka) {
      throw new Error("Judoka introuvable.");
    }
    const clubId = String(idClub || "").trim();
    if (clubId) {
      await requireClub(clubId);
    }
    await judokasRepository.setClub(judoka.id_judoka, clubId || null);
    return { success: true, message: clubId ? "Club du judoka mis à jour." : "Judoka retiré de son club." };
  }

  return {
    methods: { getClubsManagement, saveClub, deleteClub, setCoachClubs, setJudokaClub }
  };
}
