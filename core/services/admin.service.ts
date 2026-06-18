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
import type {
  createHandedness,
  createWeightCategory,
  createYearInCategory
} from "../domain/category-reference";
import type { AccessRole } from "../domain/access/role";
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
  createHandedness: typeof createHandedness;
  createWeightCategory: typeof createWeightCategory;
  createYearInCategory: typeof createYearInCategory;
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
    createHandedness,
    createWeightCategory,
    createYearInCategory,
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
    rawEmail: string,
    options: {
      accessRole?: AccessRole;
      ageCategory?: string;
      gender?: string;
      yearInCategory?: string;
      handedness?: string;
    } = {}
  ): Promise<{ idJudoka: string; email: string; message: string }> {
    const accountEmail = createEmail(rawEmail);
    const existingUser = await userContextService.getCurrentUser(accountEmail);
    if (existingUser) {
      const profileLabel = profileType === "JUDOKA" ? "judoka" : "parent";
      if (existingUser.profile_type !== profileType) {
        throw new Error(`${accountEmail} n'est pas un profil ${profileType}.`);
      }
      const sameFirstName = cleanText(existingUser.prenom).toLowerCase() === prenom.toLowerCase();
      const sameLastName = cleanText(existingUser.nom).toLowerCase() === nom.toLowerCase();
      if (!sameFirstName || !sameLastName) {
        throw new Error(`${accountEmail} correspond déjà à un autre profil ${profileLabel}.`);
      }

      const updates: {
        accessRole?: AccessRole;
        ageCategory?: string;
        gender?: string;
        yearInCategory?: string;
        handedness?: string;
      } = {};
      if (profileType === "JUDOKA") {
        if (options.accessRole && options.accessRole !== existingUser.role) {
          updates.accessRole = options.accessRole;
        }
        if (options.ageCategory && options.ageCategory !== existingUser.categorie_age) {
          updates.ageCategory = options.ageCategory;
        }
        if (options.gender && options.gender !== existingUser.genre) {
          updates.gender = options.gender;
        }
        if (options.yearInCategory && options.yearInCategory !== existingUser.annee_categorie) {
          updates.yearInCategory = options.yearInCategory;
        }
        if (options.handedness && options.handedness !== existingUser.lateralite) {
          updates.handedness = options.handedness;
        }
        if (Object.keys(updates).length) {
          await judokasRepository.update(existingUser.id_judoka, updates);
        }
      }

      return {
        idJudoka: existingUser.id_judoka,
        email: accountEmail,
        message: Object.keys(updates).length
          ? `Profil ${profileLabel} existant mis à jour.`
          : `Profil ${profileLabel} existant, aucune modification.`
      };
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
        profileType,
        ...(options.accessRole ? { role: options.accessRole } : {}),
        ...(options.ageCategory ? { ageCategory: options.ageCategory } : {}),
        ...(options.gender ? { gender: options.gender } : {}),
        ...(options.yearInCategory ? { yearInCategory: options.yearInCategory } : {}),
        ...(options.handedness ? { handedness: options.handedness } : {})
      });
      return {
        idJudoka: existingByName.id_judoka,
        email: accountEmail,
        message: "Profil existant activé avec son email."
      };
    }

    const idJudoka = buildJudokaId();
    await judokasRepository.insert(
      createJudoka({
        judokaId: idJudoka,
        accountEmail,
        firstName: prenom,
        lastName: nom,
        profileType,
        accessRole: options.accessRole || "NORMAL"
      }),
      {
        ...(options.ageCategory ? { categorie_age: options.ageCategory } : {}),
        ...(options.gender ? { genre: options.gender } : {}),
        ...(options.yearInCategory ? { annee_categorie: options.yearInCategory } : {}),
        ...(options.handedness ? { lateralite: options.handedness } : {})
      }
    );

    return {
      idJudoka,
      email: accountEmail,
      message: profileType === "PARENT" ? "Profil parent créé." : "Profil judoka créé."
    };
  }

  async function linkChildToParent(parent: JudokaRow, idJudoka: string): Promise<boolean> {
    const links = await parentLinksRepository.listByParent(parent.id_judoka);
    const alreadyLinked = links.some((link) => String(link.id_judoka) === String(idJudoka));
    if (alreadyLinked) {
      return false;
    }

    await parentLinksRepository.insert({ id_parent: parent.id_judoka, id_judoka: idJudoka });
    return true;
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
    const ageCategory = cleanText(row.agecategory);
    const gender = cleanText(row.genre);
    const yearInCategory = createYearInCategory(cleanText(row.anneecategorie), ageCategory);
    const handedness = createHandedness(cleanText(row.lateralite));
    const rawRole = cleanText(row.role).toUpperCase();
    if (rawRole && rawRole !== "NORMAL" && rawRole !== "COACH") {
      throw new Error("Rôle invalide pour l'import (NORMAL ou COACH).");
    }

    if (profileType === "PARENT") {
      if (rawRole === "COACH") {
        throw new Error("Un profil PARENT ne peut pas être COACH.");
      }
      if (rawParentEmail) {
        throw new Error("Un profil PARENT ne peut pas avoir de parentEmail.");
      }
      if (!rawEmail) {
        throw new Error("Email obligatoire pour un profil PARENT.");
      }
      return createAccountProfile("PARENT", prenom, nom, rawEmail);
    }

    if (rawRole === "COACH" && !rawEmail) {
      throw new Error("Un coach doit avoir un email pour se connecter.");
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

    if (rawEmail) {
      const accountProfile = await createAccountProfile("JUDOKA", prenom, nom, rawEmail, {
        ...(rawRole ? { accessRole: rawRole as AccessRole } : {}),
        ageCategory,
        gender,
        yearInCategory,
        handedness
      });
      if (parent) {
        const linked = await linkChildToParent(parent, accountProfile.idJudoka);
        return {
          email: accountProfile.email,
          message: linked
            ? "Profil judoka avec email rattaché au parent."
            : "Profil déjà rattaché à ce parent, aucune modification."
        };
      }

      if (pendingParentEmail) {
        await judokasRepository.update(accountProfile.idJudoka, { pendingParentEmail });
        return {
          email: accountProfile.email,
          message: `Profil judoka créé avec son email, en attente de la première connexion de ${pendingParentEmail}.`
        };
      }

      return accountProfile;
    }

    const existingChild = await judokasRepository.getByName(prenom, nom);
    if (existingChild) {
      if (existingChild.profile_type !== "JUDOKA") {
        throw new Error(`${prenom} ${nom} existe déjà avec un autre type de profil.`);
      }

      const existingId = existingChild.id_judoka;
      const ageCategoryChanged = Boolean(ageCategory) && ageCategory !== existingChild.categorie_age;
      const genderChanged = Boolean(gender) && gender !== existingChild.genre;
      const yearInCategoryChanged =
        Boolean(yearInCategory) && yearInCategory !== existingChild.annee_categorie;
      const handednessChanged = Boolean(handedness) && handedness !== existingChild.lateralite;
      const profileInfoChanged =
        ageCategoryChanged || genderChanged || yearInCategoryChanged || handednessChanged;
      if (profileInfoChanged) {
        await judokasRepository.update(existingId, {
          ...(ageCategoryChanged ? { ageCategory } : {}),
          ...(genderChanged ? { gender } : {}),
          ...(yearInCategoryChanged ? { yearInCategory } : {}),
          ...(handednessChanged ? { handedness } : {})
        });
      }

      if (parent) {
        const linked = await linkChildToParent(parent, existingId);
        if (!linked) {
          return {
            email: null,
            message: profileInfoChanged
              ? "Profil existant mis à jour, déjà rattaché à ce parent."
              : "Profil déjà rattaché à ce parent, aucune modification."
          };
        }
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

      return {
        email: null,
        message: profileInfoChanged
          ? "Profil judoka existant mis à jour."
          : "Profil déjà existant, aucune modification."
      };
    }

    const idJudoka = buildJudokaId();
    const managedChild = createManagedChild({
      judokaId: idJudoka,
      firstName: prenom,
      lastName: nom
    });
    await judokasRepository.insert(managedChild, {
      ...(ageCategory ? { categorie_age: ageCategory } : {}),
      ...(gender ? { genre: gender } : {}),
      ...(yearInCategory ? { annee_categorie: yearInCategory } : {}),
      ...(handedness ? { lateralite: handedness } : {}),
      ...(pendingParentEmail ? { pending_parent_email: pendingParentEmail } : {})
    });

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
    beltColor: string,
    gender: string,
    yearInCategory: string,
    handedness: string
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
    const targetJudoka = await judokasRepository.getById(idJudoka);
    const validatedWeightCategory = createWeightCategory(
      weightCategory,
      ageCategory,
      gender || (targetJudoka && targetJudoka.genre)
    );
    const validatedYearInCategory = createYearInCategory(yearInCategory, ageCategory);
    const validatedHandedness = createHandedness(handedness);
    await judokasRepository.saveJudokaInfo(
      idJudoka,
      String(ageCategory || ""),
      validatedWeightCategory,
      String(beltColor || ""),
      String(gender || ""),
      validatedYearInCategory,
      validatedHandedness
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
