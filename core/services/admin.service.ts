import { toCanonicalJudoka, toInvitationReadModel } from "./domain-adapters";
import {
  applyImportProfileUpdatesToRow,
  buildChangedImportProfileUpdates,
  hasImportProfileUpdates,
  toJudokaRepositoryExtras,
  type ImportProfileOptions
} from "./admin-import-mapping";
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
  getCurrentDate?: () => string;
  normalizeEmail: (value: unknown) => string;
}

export interface AdminService {
  getAccessInvitation(email: string): Promise<AccessInvitationRow | null>;
  methods: AdminMethods;
}

interface UserImportContext {
  invitationsByEmail: Map<string, AccessInvitationRow | null>;
  judokasByEmail: Map<string, JudokaRow | null>;
  judokasByName: Map<string, JudokaRow | null>;
  linksByParent: Map<string, Set<string>>;
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
    getCurrentDate = () => new Date().toISOString().slice(0, 10),
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

  function createUserImportContext(): UserImportContext {
    return {
      invitationsByEmail: new Map(),
      judokasByEmail: new Map(),
      judokasByName: new Map(),
      linksByParent: new Map()
    };
  }

  function getNameCacheKey(prenom: string, nom: string): string {
    return `${cleanText(prenom).toLowerCase()}|${cleanText(nom).toLowerCase()}`;
  }

  function cacheJudokaForImport(context: UserImportContext, judoka: JudokaRow | null): void {
    if (!judoka) {
      return;
    }
    const email = normalizeEmail(judoka.email);
    if (email) {
      context.judokasByEmail.set(email, judoka);
    }
    const prenom = cleanText(judoka.prenom);
    const nom = cleanText(judoka.nom);
    if (prenom && nom) {
      context.judokasByName.set(getNameCacheKey(prenom, nom), judoka);
    }
  }

  async function getCachedJudokaByEmail(
    context: UserImportContext,
    email: string
  ): Promise<JudokaRow | null> {
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) {
      return null;
    }
    if (context.judokasByEmail.has(normalizedEmail)) {
      return context.judokasByEmail.get(normalizedEmail) || null;
    }

    const judoka = await judokasRepository.getByEmail(normalizedEmail);
    context.judokasByEmail.set(normalizedEmail, judoka);
    cacheJudokaForImport(context, judoka);
    return judoka;
  }

  async function getCachedCurrentUser(
    context: UserImportContext,
    email: string
  ): Promise<JudokaRow | null> {
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) {
      return null;
    }
    if (context.judokasByEmail.has(normalizedEmail)) {
      return context.judokasByEmail.get(normalizedEmail) || null;
    }

    const judoka = await userContextService.getCurrentUser(normalizedEmail);
    context.judokasByEmail.set(normalizedEmail, judoka);
    cacheJudokaForImport(context, judoka);
    return judoka;
  }

  async function getCachedJudokaByName(
    context: UserImportContext,
    prenom: string,
    nom: string
  ): Promise<JudokaRow | null> {
    const key = getNameCacheKey(prenom, nom);
    if (context.judokasByName.has(key)) {
      return context.judokasByName.get(key) || null;
    }

    const judoka = await judokasRepository.getByName(prenom, nom);
    context.judokasByName.set(key, judoka);
    cacheJudokaForImport(context, judoka);
    return judoka;
  }

  async function getCachedAccessInvitation(
    context: UserImportContext,
    email: string
  ): Promise<AccessInvitationRow | null> {
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) {
      return null;
    }
    if (context.invitationsByEmail.has(normalizedEmail)) {
      return context.invitationsByEmail.get(normalizedEmail) || null;
    }

    const invitation = await getAccessInvitation(normalizedEmail);
    context.invitationsByEmail.set(normalizedEmail, invitation);
    return invitation;
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
    context: UserImportContext,
    profileType: "JUDOKA" | "PARENT",
    prenom: string,
    nom: string,
    rawEmail: string,
    options: ImportProfileOptions = {}
  ): Promise<{ idJudoka: string; email: string; message: string }> {
    const accountEmail = createEmail(rawEmail);
    const existingUser = await getCachedCurrentUser(context, accountEmail);
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

      const updates = buildChangedImportProfileUpdates(existingUser, options);
      if (profileType === "JUDOKA") {
        if (hasImportProfileUpdates(updates)) {
          await judokasRepository.update(existingUser.id_judoka, updates);
          cacheJudokaForImport(context, applyImportProfileUpdatesToRow(existingUser, updates));
        }
      }

      return {
        idJudoka: existingUser.id_judoka,
        email: accountEmail,
        message: hasImportProfileUpdates(updates)
          ? `Profil ${profileLabel} existant mis à jour.`
          : `Profil ${profileLabel} existant, aucune modification.`
      };
    }

    const existingByName = await getCachedJudokaByName(context, prenom, nom);
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
        ...(options.beltColor ? { beltColor: options.beltColor } : {}),
        ...(options.gender ? { gender: options.gender } : {}),
        ...(options.yearInCategory ? { yearInCategory: options.yearInCategory } : {}),
        ...(options.handedness ? { handedness: options.handedness } : {})
      });
      cacheJudokaForImport(context, {
        ...existingByName,
        email: accountEmail,
        profile_type: profileType,
        ...(options.accessRole ? { role: options.accessRole } : {}),
        ...toJudokaRepositoryExtras(options)
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
        ...toJudokaRepositoryExtras(options)
      }
    );
    cacheJudokaForImport(context, {
      id_judoka: idJudoka,
      email: accountEmail,
      prenom,
      nom,
      profile_type: profileType,
      role: options.accessRole || "NORMAL",
      categorie_age: options.ageCategory || "",
      couleur_ceinture: options.beltColor || "",
      genre: options.gender || "",
      annee_categorie: options.yearInCategory || "",
      lateralite: options.handedness || ""
    });

    return {
      idJudoka,
      email: accountEmail,
      message: profileType === "PARENT" ? "Profil parent créé." : "Profil judoka créé."
    };
  }

  async function linkChildToParent(
    context: UserImportContext,
    parent: JudokaRow,
    idJudoka: string
  ): Promise<boolean> {
    let links = context.linksByParent.get(parent.id_judoka);
    if (!links) {
      const existingLinks = await parentLinksRepository.listByParent(parent.id_judoka);
      links = new Set(existingLinks.map((link) => String(link.id_judoka)));
      context.linksByParent.set(parent.id_judoka, links);
    }

    const alreadyLinked = links.has(String(idJudoka));
    if (alreadyLinked) {
      return false;
    }

    await parentLinksRepository.insert({ id_parent: parent.id_judoka, id_judoka: idJudoka });
    links.add(String(idJudoka));
    return true;
  }

  async function importUserRow(
    context: UserImportContext,
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
    const beltColor = cleanText(row.couleur_ceinture);
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
      return createAccountProfile(context, "PARENT", prenom, nom, rawEmail);
    }

    if (rawRole === "COACH" && !rawEmail) {
      throw new Error("Un coach doit avoir un email pour se connecter.");
    }

    let parent: JudokaRow | null = null;
    let pendingParentEmail: string | null = null;
    if (rawParentEmail) {
      parent = await getCachedJudokaByEmail(context, rawParentEmail);
      if (parent) {
        if (parent.profile_type !== "PARENT") {
          throw new Error(`${rawParentEmail} n'est pas un profil PARENT.`);
        }
      } else {
        const invitation = await getCachedAccessInvitation(context, rawParentEmail);
        if (!invitation || invitation.invited_profile_type !== "PARENT") {
          throw new Error(
            `Aucune invitation ni compte PARENT trouvé pour ${rawParentEmail}. Invitez d'abord ce parent.`
          );
        }
        pendingParentEmail = rawParentEmail;
      }
    }

    if (rawEmail) {
      const accountProfile = await createAccountProfile(context, "JUDOKA", prenom, nom, rawEmail, {
        ...(rawRole ? { accessRole: rawRole as AccessRole } : {}),
        ageCategory,
        beltColor,
        gender,
        yearInCategory,
        handedness
      });
      if (parent) {
        const linked = await linkChildToParent(context, parent, accountProfile.idJudoka);
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

    const existingChild = await getCachedJudokaByName(context, prenom, nom);
    if (existingChild) {
      if (existingChild.profile_type !== "JUDOKA") {
        throw new Error(`${prenom} ${nom} existe déjà avec un autre type de profil.`);
      }

      const existingId = existingChild.id_judoka;
      const profileUpdates = buildChangedImportProfileUpdates(existingChild, {
        ...(rawRole ? { accessRole: rawRole as AccessRole } : {}),
        ageCategory,
        beltColor,
        gender,
        yearInCategory,
        handedness
      });
      const profileInfoChanged = hasImportProfileUpdates(profileUpdates);
      if (profileInfoChanged) {
        await judokasRepository.update(existingId, profileUpdates);
        cacheJudokaForImport(context, applyImportProfileUpdatesToRow(existingChild, profileUpdates));
      }

      if (parent) {
        const linked = await linkChildToParent(context, parent, existingId);
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
        cacheJudokaForImport(context, {
          ...existingChild,
          pending_parent_email: pendingParentEmail
        });
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
      ...(beltColor ? { couleur_ceinture: beltColor } : {}),
      ...(gender ? { genre: gender } : {}),
      ...(yearInCategory ? { annee_categorie: yearInCategory } : {}),
      ...(handedness ? { lateralite: handedness } : {}),
      ...(pendingParentEmail ? { pending_parent_email: pendingParentEmail } : {})
    });
    cacheJudokaForImport(context, {
      id_judoka: idJudoka,
      email: "",
      prenom,
      nom,
      profile_type: "JUDOKA",
      role: "NORMAL",
      categorie_age: ageCategory || "",
      couleur_ceinture: beltColor || "",
      genre: gender || "",
      annee_categorie: yearInCategory || "",
      lateralite: handedness || "",
      pending_parent_email: pendingParentEmail || ""
    });

    if (parent) {
      await linkChildToParent(context, parent, idJudoka);
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
    const importContext = createUserImportContext();
    for (let index = 0; index < rows.length; index += 1) {
      const rowNumber = index + 2;
      const row = rows[index];
      const label = `${cleanText(row.prenom)} ${cleanText(row.nom)}`.trim() || `ligne ${rowNumber}`;
      try {
        const outcome = await importUserRow(importContext, row);
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
    if (!domainUser.isCoach() && !isSelf && !isManagedJudoka) {
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

    const competitions = await competitionsRepository.listByJudoka(idJudoka);
    const today = getCurrentDate();
    const lockedCompetitions = competitions.filter((competition) => String(competition.date || "") <= today);
    if (lockedCompetitions.length) {
      throw new Error("Impossible de supprimer un utilisateur ayant des compétitions passées ou terminées.");
    }

    if (competitions.length) {
      await competitionsRepository.removeByJudoka(idJudoka);
    }
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
