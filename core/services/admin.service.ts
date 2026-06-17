import { toCanonicalJudoka, toInvitationReadModel } from "./domain-adapters";
import type { AccessInvitationRow, JudokaRow } from "../repositories/types";
import type { CompetitionsRepository } from "../repositories/competitions.repository";
import type { InvitationsRepository } from "../repositories/invitations.repository";
import type { JudokasRepository } from "../repositories/judokas.repository";
import type { ParentLinksRepository } from "../repositories/parent-links.repository";
import type { RpcMethods, UserImportRowResult } from "../types";
import type { UserContextService } from "./user-context.service";
import type { createEmail } from "../domain/access/email";
import type { createJudoka, createManagedChild } from "../domain/access/judoka";
import type { createProfileType } from "../domain/access/profile-type";
import { parseCsv } from "../shared/csv";

type AdminMethods = Pick<
  RpcMethods,
  | "deleteAccessInvitation"
  | "deleteUser"
  | "getAdminsManagement"
  | "grantAdminRole"
  | "importUsersCsv"
  | "revokeAdminRole"
  | "saveJudokaInfo"
>;

export interface AdminServiceDeps {
  competitionsRepository: CompetitionsRepository;
  invitationsRepository: InvitationsRepository;
  judokasRepository: JudokasRepository;
  parentLinksRepository: ParentLinksRepository;
  userContextService: UserContextService;
  buildJudokaId: () => string;
  cleanText: (value: unknown) => string;
  createEmail: typeof createEmail;
  createJudoka: typeof createJudoka;
  createManagedChild: typeof createManagedChild;
  createProfileType: typeof createProfileType;
  normalizeEmail: (value: unknown) => string;
}

export interface AdminService {
  getAccessInvitation(email: string): Promise<AccessInvitationRow | null>;
  methods: AdminMethods;
}

export default function createAdminService(deps: AdminServiceDeps): AdminService {
  const {
    competitionsRepository,
    invitationsRepository,
    judokasRepository,
    parentLinksRepository,
    userContextService,
    buildJudokaId,
    cleanText,
    createEmail,
    createJudoka,
    createManagedChild,
    createProfileType,
    normalizeEmail
  } = deps;

  async function requireAdminUser(email: string): Promise<JudokaRow> {
    const user = await userContextService.getCurrentUser(email);
    if (!user) {
      throw new Error(`Accès refusé pour : ${email}`);
    }
    if (!createJudoka(toCanonicalJudoka(user)).isAdmin()) {
      throw new Error("Gestion des admins réservée aux admins.");
    }
    return user;
  }

  async function requireCoachUser(email: string): Promise<JudokaRow> {
    const user = await userContextService.getCurrentUser(email);
    if (!user) {
      throw new Error(`Accès refusé pour : ${email}`);
    }
    if (!createJudoka(toCanonicalJudoka(user)).isCoach()) {
      throw new Error("Gestion du profil sportif réservée aux coachs.");
    }
    return user;
  }

  async function getAdmins(): Promise<JudokaRow[]> {
    return judokasRepository.listAdmins();
  }

  async function getAccessInvitation(email: string): Promise<AccessInvitationRow | null> {
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) {
      return null;
    }

    return invitationsRepository.getByEmail(normalizedEmail);
  }

  async function getAdminsManagement(email: string) {
    const user = await requireAdminUser(email);
    return {
      user: toCanonicalJudoka(user),
      admins: (await getAdmins()).map(toCanonicalJudoka),
      users: (await judokasRepository.listAll()).map(toCanonicalJudoka),
      accessInvitations: (await invitationsRepository.listAll()).map(toInvitationReadModel)
    };
  }

  async function grantAdminRole(email: string, targetEmail: string) {
    await requireAdminUser(email);
    const normalizedEmail = createEmail(targetEmail);

    const target = await userContextService.getCurrentUser(normalizedEmail);
    if (!target) {
      throw new Error("Aucun judoka trouvé avec cet email.");
    }

    await judokasRepository.update(
      target.id_judoka,
      createJudoka(toCanonicalJudoka(target)).grantAdminRole()
    );

    return {
      success: true,
      judokaId: target.id_judoka,
      message: "Droits admin accordés."
    };
  }

  async function createAccountProfile(
    profileType: "JUDOKA" | "PARENT",
    prenom: string,
    nom: string,
    rawEmail: string
  ): Promise<{ email: string; message: string }> {
    const accountEmail = createEmail(rawEmail);
    const existingUser = await userContextService.getCurrentUser(accountEmail);
    if (existingUser) {
      throw new Error("Ce compte dispose déjà d'un accès.");
    }

    const existingByName = await judokasRepository.getByName(prenom, nom);
    if (existingByName) {
      if (existingByName.profile_type !== profileType) {
        throw new Error(`${prenom} ${nom} existe déjà avec un autre type de profil.`);
      }
      if (existingByName.email) {
        throw new Error("Ce profil dispose déjà d'un email de connexion.");
      }

      await judokasRepository.update(existingByName.id_judoka, {
        accountEmail,
        profileType
      });
      return { email: accountEmail, message: "Profil existant activé avec son email." };
    }

    await judokasRepository.insert(
      createJudoka({
        judokaId: buildJudokaId(),
        accountEmail,
        firstName: prenom,
        lastName: nom,
        profileType,
        accessRole: "NORMAL"
      })
    );

    return {
      email: accountEmail,
      message: profileType === "PARENT" ? "Profil parent créé." : "Profil judoka créé."
    };
  }

  async function importUserRow(
    row: Record<string, string>
  ): Promise<{ email: string | null; message: string }> {
    const profileType = createProfileType(row.profiletype);
    const prenom = cleanText(row.prenom);
    const nom = cleanText(row.nom);
    if (!prenom || !nom) {
      throw new Error("Prénom et nom obligatoires.");
    }

    const rawEmail = cleanText(row.email);
    const rawParentEmail = cleanText(row.parentemail);

    if (profileType === "PARENT") {
      if (rawParentEmail) {
        throw new Error("Un profil PARENT ne peut pas avoir de parentEmail.");
      }
      if (!rawEmail) {
        throw new Error("Email obligatoire pour un profil PARENT.");
      }
      return createAccountProfile("PARENT", prenom, nom, rawEmail);
    }

    if (rawEmail) {
      if (rawParentEmail) {
        throw new Error(
          "Un judoka avec son propre email ne peut pas être rattaché via parentEmail."
        );
      }
      return createAccountProfile("JUDOKA", prenom, nom, rawEmail);
    }

    let parent: JudokaRow | null = null;
    let pendingParentEmail: string | null = null;
    if (rawParentEmail) {
      parent = await judokasRepository.getByEmail(rawParentEmail);
      if (parent) {
        if (parent.profile_type !== "PARENT") {
          throw new Error(`${rawParentEmail} n'est pas un profil PARENT.`);
        }
      } else {
        const invitation = await getAccessInvitation(rawParentEmail);
        if (!invitation || invitation.invited_profile_type !== "PARENT") {
          throw new Error(
            `Aucune invitation ni compte PARENT trouvé pour ${rawParentEmail}. Invitez d'abord ce parent.`
          );
        }
        pendingParentEmail = rawParentEmail;
      }
    }

    const existingChild = await judokasRepository.getByName(prenom, nom);
    if (existingChild) {
      if (existingChild.profile_type !== "JUDOKA") {
        throw new Error(`${prenom} ${nom} existe déjà avec un autre type de profil.`);
      }

      const existingId = existingChild.id_judoka;

      if (parent) {
        const links = await parentLinksRepository.listByParent(parent.id_judoka);
        const alreadyLinked = links.some(
          (link) => String(link.id_judoka) === String(existingId)
        );
        if (alreadyLinked) {
          return { email: null, message: "Profil déjà rattaché à ce parent, aucune modification." };
        }
        await parentLinksRepository.insert({ id_parent: parent.id_judoka, id_judoka: existingId });
        return { email: null, message: "Profil existant rattaché au parent." };
      }

      if (
        pendingParentEmail &&
        String(existingChild.pending_parent_email || "").toLowerCase() !==
          pendingParentEmail.toLowerCase()
      ) {
        await judokasRepository.update(existingId, { pendingParentEmail });
        return {
          email: null,
          message: `Profil existant, en attente de la première connexion de ${pendingParentEmail}.`
        };
      }

      return { email: null, message: "Profil déjà existant, aucune modification." };
    }

    const idJudoka = buildJudokaId();
    const managedChild = createManagedChild({
      judokaId: idJudoka,
      firstName: prenom,
      lastName: nom
    });
    await judokasRepository.insert(
      managedChild,
      pendingParentEmail ? { pending_parent_email: pendingParentEmail } : undefined
    );

    if (parent) {
      await parentLinksRepository.insert({ id_parent: parent.id_judoka, id_judoka: idJudoka });
      return { email: null, message: "Profil judoka créé et rattaché au parent." };
    }

    if (pendingParentEmail) {
      return {
        email: null,
        message: `Profil judoka créé, en attente de la première connexion de ${pendingParentEmail}.`
      };
    }

    return { email: null, message: "Profil judoka créé." };
  }

  async function importUsersCsv(email: string, csvContent: string) {
    await requireAdminUser(email);
    const rows = parseCsv(String(csvContent || ""));
    if (!rows.length) {
      throw new Error("Fichier CSV vide.");
    }

    const results: UserImportRowResult[] = [];
    for (let index = 0; index < rows.length; index += 1) {
      const rowNumber = index + 2;
      const row = rows[index];
      const label = `${cleanText(row.prenom)} ${cleanText(row.nom)}`.trim() || `ligne ${rowNumber}`;
      try {
        const outcome = await importUserRow(row);
        results.push({
          row: rowNumber,
          name: label,
          email: outcome.email,
          success: true,
          message: outcome.message
        });
      } catch (error) {
        results.push({
          row: rowNumber,
          name: label,
          email: cleanText(row.email) || null,
          success: false,
          message: error instanceof Error ? error.message : "Erreur inconnue."
        });
      }
    }

    return {
      success: results.every((result) => result.success),
      imported: results.filter((result) => result.success).length,
      failed: results.filter((result) => !result.success).length,
      results
    };
  }

  async function revokeAdminRole(email: string, idJudoka: string) {
    const user = await requireAdminUser(email);
    if (!idJudoka) {
      throw new Error("Admin obligatoire.");
    }
    if (String(user.id_judoka) === String(idJudoka)) {
      throw new Error("Vous ne pouvez pas retirer vos propres droits admin.");
    }

    const target = await userContextService.getJudokaById(idJudoka);
    if (!target) {
      throw new Error("Admin introuvable.");
    }

    await judokasRepository.update(
      idJudoka,
      createJudoka(toCanonicalJudoka(target)).revokeAdminRole(user.id_judoka)
    );

    return { success: true, message: "Droits admin retirés." };
  }

  async function saveJudokaInfo(
    email: string,
    idJudoka: string,
    ageCategory: string,
    weightCategory: string,
    beltColor: string
  ) {
    const userContext = await userContextService.getCurrentUserContext(email);
    const { user, managedJudokaScope } = userContext;
    if (!idJudoka) throw new Error("Judoka obligatoire.");
    const domainUser = createJudoka(toCanonicalJudoka(user));
    const isSelf = user.id_judoka === idJudoka;
    const isManagedJudoka = managedJudokaScope.includes(idJudoka);
    if (!domainUser.isCoach() && !domainUser.isAdmin() && !isSelf && !isManagedJudoka) {
      throw new Error("Modification de profil non autorisée.");
    }
    await judokasRepository.saveJudokaInfo(
      idJudoka,
      String(ageCategory || ""),
      String(weightCategory || ""),
      String(beltColor || "")
    );
    return { success: true, message: "Profil mis à jour." };
  }

  async function deleteAccessInvitation(email: string, invitedEmail: string) {
    await requireAdminUser(email);
    const normalizedEmail = normalizeEmail(invitedEmail);
    if (!normalizedEmail) {
      throw new Error("Invitation obligatoire.");
    }

    const invitation = await getAccessInvitation(normalizedEmail);
    if (!invitation) {
      throw new Error("Invitation introuvable.");
    }

    await invitationsRepository.removeByEmail(normalizedEmail);
    return { success: true, message: "Invitation annulée." };
  }

  async function deleteUser(email: string, idJudoka: string) {
    const user = await requireAdminUser(email);
    if (!idJudoka) {
      throw new Error("Utilisateur obligatoire.");
    }
    if (String(user.id_judoka) === String(idJudoka)) {
      throw new Error("Vous ne pouvez pas supprimer votre propre compte.");
    }

    const target = await userContextService.getJudokaById(idJudoka);
    if (!target) {
      throw new Error("Utilisateur introuvable.");
    }
    if (target.role === "ADMIN") {
      throw new Error("Retirez d'abord les droits admin avant de supprimer ce compte.");
    }

    await competitionsRepository.removeByJudoka(idJudoka);
    await judokasRepository.remove(idJudoka);
    return { success: true, message: "Utilisateur supprimé." };
  }

  return {
    getAccessInvitation,
    methods: {
      deleteAccessInvitation,
      deleteUser,
      getAdminsManagement,
      grantAdminRole,
      importUsersCsv,
      revokeAdminRole,
      saveJudokaInfo
    }
  };
}
