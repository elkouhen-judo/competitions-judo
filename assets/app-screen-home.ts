(() => {
  type KirokuApp = import("./types").KirokuApp;
  type Judoka = import("../core/types").Judoka;
  type HomeMode = "judoka" | "parentHome" | "coachHome" | "coach" | "coachJudoka" | "family";
  type AppScreens = import("./types").AppScreens;
  type KirokuAppState = import("./types").KirokuAppState;
  type KirokuUi = import("./types").KirokuUi;

  interface HomeFilterOption {
    judokaId: string;
    name: string;
    meta: string;
    /** UIX-016e : catégorie, poids et club, sans la mention « Non réinscrit ». */
    details: string;
    isUnregistered: boolean;
    ageCategory: string;
    searchText: string;
  }

  interface HomeClubCompetitionCard {
    clubCompetitionId: string;
    name: string;
    dateLabel: string;
    whenLabel: string;
    isToday: boolean;
    isUpcoming: boolean;
    summary: string;
    clubName: string;
    missingRankingCount: number;
    missingRankingLabel: string;
  }

  interface HomeCompetitionCard {
    competitionId: string;
    name: string;
    dateLabel: string;
    whenLabel: string;
    isUpcoming: boolean;
    resultLabel: string;
    recordLabel: string;
    needsRanking: boolean;
    hasCoachReview: boolean;
    rankDotLabel: string;
    rankDotClass: string;
  }

  interface HomeChildOption {
    judokaId: string;
    firstName: string;
    name: string;
    ageCategory: string;
    initials: string;
    meta: string;
    beltBackground: string;
  }

  // Mode/context concern: which modes are available, which one is active, and the
  // labels/visibility flags that depend purely on the current mode + active judoka.
  function createHomeModeController(deps: {
    state: KirokuAppState;
    screens: AppScreens;
    ui: KirokuUi;
    getCurrentMode: () => HomeMode;
    getHomeActiveJudoka: () => Judoka | null;
    getHomeActiveJudokaId: () => string;
    getHomeViewModel: () => { filterJudokaText: string; showFilterOptions: boolean };
    ensureHomeActiveJudokaSelection: () => void;
  }) {
    const {
      state,
      screens,
      ui,
      getCurrentMode,
      getHomeActiveJudoka,
      getHomeActiveJudokaId,
      getHomeViewModel,
      ensureHomeActiveJudokaSelection
    } = deps;
    const { cleanText, getJudokaDisplayName, showView } = ui;

    function isPrimaryModeActive(modeKey: string): boolean {
      return modeKey === getCurrentMode();
    }

    function getJudokaFirstName(judoka: Judoka): string {
      const firstName = ui.normalizeDisplayName(cleanText(judoka.firstName));
      if (firstName) return firstName;
      return cleanText(getJudokaDisplayName(judoka)).split(/\s+/)[0] || "";
    }

    // Espaces hors coach : « Mon espace » pour un compte qui pratique, « Famille » pour un parent.
    const availableModes = window.Vue.computed(() => {
      const hasOwnSpace = state.currentUser?.profileType !== "PARENT";
      const modes: Array<{ key: string; label: string }> = hasOwnSpace ? [{ key: "judoka", label: "Mon espace" }] : [];
      if (state.isParent) {
        modes.push({ key: "family", label: "Ma famille" });
      }
      return modes;
    });

    // NAV-2 : les mêmes onglets sur tous les écrans coach ; « Mon espace » et « Gestion des accès »
    // passent dans le menu du compte (en-tête).
    // NAV-7 : cinq onglets dans l'ordre d'une saison ; barre en bas sur mobile, en haut sur desktop.
    const coachSubModes = window.Vue.computed(() => [
      { key: "coachHome", label: "Accueil", icon: "home" },
      { key: "coachJudoka", label: "Judokas", icon: "judokas" },
      { key: "coachAgenda", label: "Agenda", icon: "agenda" },
      { key: "coach", label: "Compétitions", icon: "comp" },
      { key: "coachDashboard", label: "Statistiques", icon: "stats" }
    ]);

    const showCoachSubTabs = window.Vue.computed(() => state.isCoach);
    const showModeTabs = window.Vue.computed(() => !state.isCoach && availableModes.value.length > 1);
    const currentHomeMode = window.Vue.computed(() => getCurrentMode());

    const canFilterByJudoka = window.Vue.computed(() => getCurrentMode() === "coachJudoka" && state.judokas.length > 0);

    // INSCR-2 : un judoka non réinscrit pour la saison en cours ne peut plus être engagé.
    const homeRegistrationNotice = window.Vue.computed(() => {
      const mode = getCurrentMode();
      if (!["judoka", "family"].includes(mode)) return "";
      const judoka = mode === "judoka" ? state.currentUser : getHomeActiveJudoka();
      const today = ui.getCurrentLocalDate();
      if (!judoka || ui.isRegisteredForDate(judoka, today)) return "";
      const season = ui.getSeasonStartYear(today);
      return season === null ? "" : `Non réinscrit pour la saison ${ui.formatSeasonLabel(season)}.`;
    });
    const canCreateClubCompetition = window.Vue.computed(() => getCurrentMode() === "coach" && state.isCoach);
    const canOpenJudokaProfile = window.Vue.computed(() => {
      const mode = getCurrentMode();
      // V2 A : en famille et dans « Mon espace », la fiche s'ouvre depuis le bloc « La saison de … ».
      return mode === "coachJudoka" && Boolean(getHomeActiveJudokaId());
    });
    const showClubCompetitionsSection = window.Vue.computed(() => getCurrentMode() === "coach");
    const showCoachHub = window.Vue.computed(() => getCurrentMode() === "coachHome");
    const showHomeHero = window.Vue.computed(() => showCoachSubTabs.value || showModeTabs.value);
    const showHomeActions = window.Vue.computed(
      () =>
        Boolean(state.currentUser) &&
        (canCreateClubCompetition.value || canOpenJudokaProfile.value)
    );
    const actionDisabled = window.Vue.computed(() => {
      const mode = getCurrentMode();
      return (mode === "family" || mode === "coachJudoka") && !getHomeActiveJudokaId();
    });

    const homeContext = window.Vue.computed(() => {
      const mode = getCurrentMode();
      const activeJudoka = getHomeActiveJudoka();
      const firstName = activeJudoka ? getJudokaFirstName(activeJudoka) : "";

      if (mode === "judoka") {
        return {
          filterPlaceholder: "",
          profileButtonText: "Ma fiche",
          showCompetitionsSection: true
        };
      }
      if (mode === "coachJudoka") {
        return {
          filterPlaceholder: "Nom du judoka…",
          profileButtonText: firstName ? `Fiche de ${firstName}` : "Voir la fiche",
          showCompetitionsSection: Boolean(activeJudoka)
        };
      }
      if (mode === "family") {
        return {
          filterPlaceholder: "",
          profileButtonText: firstName ? `Fiche de ${firstName}` : "Voir la fiche",
          showCompetitionsSection: Boolean(activeJudoka)
        };
      }
      return {
        filterPlaceholder: "",
        profileButtonText: "",
        showCompetitionsSection: false
      };
    });

    const filterPlaceholder = window.Vue.computed(() => homeContext.value.filterPlaceholder);
    const profileButtonText = window.Vue.computed(() => homeContext.value.profileButtonText);
    const showCompetitionsSection = window.Vue.computed(() => homeContext.value.showCompetitionsSection);

    function setHomeMode(mode: HomeMode) {
      // L'ancien accueil parent est fusionné dans « Famille ».
      const targetMode: HomeMode = mode === "parentHome" ? "family" : mode;
      state.homeMode = targetMode;
      state.competitionsCurrentPage = 1;
      state.clubCompetitionsCurrentPage = 1;
      const vm = getHomeViewModel();
      vm.showFilterOptions = false;
      ensureHomeActiveJudokaSelection();
      showView("homeView", { routeState: { homeMode: targetMode }, replace: true });
      window.Vue.nextTick(() => window.scrollTo({ top: 0 }));
    }

    function handleModeTabClick(modeKey: string) {
      if (modeKey === "admin") {
        screens.admins.showAdminsManagement();
        return;
      }
      if (modeKey === "coachDashboard") {
        screens.coachDashboard.showCoachDashboard();
        return;
      }
      // AGD-001 : l'agenda FFJDA est un onglet du coach.
      if (modeKey === "coachAgenda") {
        screens.ffjudoAgenda.showFfjudoAgenda();
        return;
      }
      setHomeMode(modeKey as HomeMode);
    }

    function openCoachCompetitionsHub() {
      setHomeMode("coach");
    }

    return {
      isPrimaryModeActive,
      availableModes,
      coachSubModes,
      showModeTabs,
      currentHomeMode,
      showCoachSubTabs,
      canFilterByJudoka,
      homeRegistrationNotice,
      canCreateClubCompetition,
      canOpenJudokaProfile,
      showClubCompetitionsSection,
      showCoachHub,
      showHomeHero,
      showHomeActions,
      actionDisabled,
      filterPlaceholder,
      profileButtonText,
      showCompetitionsSection,
      setHomeMode,
      handleModeTabClick,
      openCoachCompetitionsHub
    };
  }

  function createKirokuHomeScreen(app: KirokuApp) {
    const { defaultListPageSize, state, screens, ui, notifications } = app;
    const { cleanText, formatCompetitionName, formatDate, getJudokaDisplayName, showView } = ui;
    const { showError, showSuccess } = notifications;
    const PODIUM_RESULTS = ["1er", "2e", "3e"];
    // Classes écrites en entier pour que Tailwind les garde (MEDAL-1).
    const MEDAL_CLASSES = ["medal-1", "medal-2", "medal-3"];
    const defaultHomeViewState = {
      filterJudokaText: "",
      filterOptions: [] as HomeFilterOption[],
      showFilterOptions: false,
      judokaRosterPage: 1,
      judokaRosterPageSize: defaultListPageSize,
      /** ACCUEIL-5 : confirmation du classement saisi depuis l'accueil. */
      homeRankingSavedText: "",
      homeRankingSavedCompetitionId: ""
    };
    let homeViewModelRef: (typeof defaultHomeViewState) | null = null;
    let hideFilterOptionsTimer: number | null = null;

    function getHomeViewModel() {
      ensureHomeViewModel();
      if (!homeViewModelRef) {
        throw new Error("Vue model de l'accueil non initialisé.");
      }
      return homeViewModelRef;
    }

    function getCurrentMode(): HomeMode {
      return state.homeMode;
    }

    function getTodayStr() {
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, "0");
      return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    }

    function getAccessibleHomeJudokas() {
      if (!state.currentUser) return [];
      if (getCurrentMode() === "judoka") return [state.currentUser];
      // Un profil PARENT n'a pas de pratique sportive : seuls ses enfants sont sélectionnables.
      if (state.currentUser.profileType === "PARENT" && !state.isCoach) {
        const selfId = String(state.currentUser.judokaId || "");
        const children = state.judokas.filter((j) => String(j.judokaId) !== selfId);
        if (children.length > 0) return children;
      }
      // Coach de plusieurs clubs : le filtre club de l'accueil restreint la liste des judokas.
      if (state.isCoach && state.selectedClubId) {
        return state.judokas.filter((j) => ui.getJudokaClubIds(j).includes(state.selectedClubId));
      }
      return state.judokas.length > 0 ? state.judokas : [state.currentUser];
    }

    function getHomeActiveJudokaId() {
      if (!state.currentUser) return "";
      const mode = getCurrentMode();
      if (mode === "judoka") return String(state.currentUser.judokaId || "");
      if (mode === "family" || mode === "parentHome" || mode === "coachJudoka") return state.homeFilterJudokaId || "";
      return "";
    }

    function getHomeActiveJudoka() {
      const targetId = getHomeActiveJudokaId();
      if (!targetId) return null;
      return getAccessibleHomeJudokas().find((j) => String(j.judokaId) === String(targetId)) || null;
    }

    // Enfants suivis par le compte (le profil du parent lui-même est exclu).
    function getChildren(): Judoka[] {
      const selfId = String(state.currentUser?.judokaId || "");
      return getAccessibleHomeJudokas()
        .filter((j) => String(j.judokaId) !== selfId)
        .sort((a, b) => cleanText(a.firstName).localeCompare(cleanText(b.firstName), "fr"));
    }

    const lastChildStorageKey = () => `kiroku_last_child_${String(state.currentUser?.judokaId || "")}`;

    function readRememberedChildId(): string {
      try {
        return localStorage.getItem(lastChildStorageKey()) || "";
      } catch {
        return "";
      }
    }

    function rememberChild(judokaId: string) {
      try {
        localStorage.setItem(lastChildStorageKey(), judokaId);
      } catch {
        // Stockage indisponible (navigation privée) : le choix vaut pour la session.
      }
    }

    function ensureHomeActiveJudokaSelection() {
      const mode = getCurrentMode();
      if (mode !== "family" && mode !== "parentHome" && mode !== "coachJudoka") return;

      const viewModel = getHomeViewModel();
      const accessibleJudokas = getAccessibleHomeJudokas();
      const currentValue = state.homeFilterJudokaId;

      if (currentValue && accessibleJudokas.some((j) => String(j.judokaId) === String(currentValue))) {
        return;
      }

      // ACCUEIL-2 : un parent retrouve le dernier enfant consulté, sinon le premier ; le coach
      // choisit toujours le judoka consulté.
      let autoJudoka: Judoka | null = null;
      if (mode !== "coachJudoka") {
        const children = getChildren();
        const remembered = readRememberedChildId();
        autoJudoka = children.find((j) => String(j.judokaId) === remembered) || children[0] || null;
      }
      viewModel.filterJudokaText = autoJudoka ? getJudokaDisplayName(autoJudoka) : "";
      state.homeFilterJudokaId = autoJudoka ? String(autoJudoka.judokaId) : "";
      if (mode === "coachJudoka") refreshJudokaRoster();
    }

    // UIX-016e : sans judoka choisi, l'onglet « Judokas » liste les judokas du club.
    function refreshJudokaRoster() {
      getHomeViewModel().judokaRosterPage = 1;
      refreshHomeFilterOptions();
    }

    function openHomeJudokaProfile() {
      if (!state.currentUser) {
        showError({ message: "Utilisateur introuvable." });
        return;
      }
      const targetJudokaId = getHomeActiveJudokaId();
      if (!targetJudokaId) {
        showError({ message: "Choisissez d'abord un judoka." });
        return;
      }
      screens.judoka.showJudokaProfile(targetJudokaId);
    }

    const homeMode = createHomeModeController({
      state,
      screens,
      ui,
      getCurrentMode,
      getHomeActiveJudoka,
      getHomeActiveJudokaId,
      getHomeViewModel,
      ensureHomeActiveJudokaSelection
    });
    const {
      isPrimaryModeActive,
      availableModes,
      coachSubModes,
      showModeTabs,
      currentHomeMode,
      showCoachSubTabs,
      canFilterByJudoka,
      homeRegistrationNotice,
      canCreateClubCompetition,
      canOpenJudokaProfile,
      showClubCompetitionsSection,
      showCoachHub,
      showHomeHero,
      showHomeActions,
      actionDisabled,
      filterPlaceholder,
      profileButtonText,
      showCompetitionsSection,
      setHomeMode,
      handleModeTabClick,
      openCoachCompetitionsHub
    } = homeMode;

    const homeFilterLabel = window.Vue.computed(() => "Judoka consulté");
    const filterJudokaId = window.Vue.computed(() => state.homeFilterJudokaId);
    const isSubmitting = window.Vue.computed(() => state.isSubmitting);
    const isHomeReady = window.Vue.computed(() => Boolean(state.currentUser));
    const childOptions = window.Vue.computed((): HomeChildOption[] =>
      getChildren().map((child) => ({
        judokaId: String(child.judokaId || ""),
        firstName: ui.normalizeDisplayName(cleanText(child.firstName)) || getJudokaDisplayName(child),
        name: getJudokaDisplayName(child),
        ageCategory: cleanText(child.ageCategory),
        initials: ui.getJudokaInitials(child),
        meta: [cleanText(child.ageCategory), cleanText(child.beltColor)].filter(Boolean).join(" · "),
        beltBackground: ui.getBeltBackground(child.beltColor)
      }))
    );

    // ACCUEIL-5 : la compétition passée la plus récente sans classement se classe depuis l'accueil.
    const homePendingRanking = window.Vue.computed(() => {
      const mode = getCurrentMode();
      if (mode !== "family" && mode !== "judoka") return null;
      const owner = mode === "judoka" ? state.currentUser : getHomeActiveJudoka();
      if (!owner) return null;
      const ownerId = String(owner.judokaId || "");
      const today = getTodayStr();
      const pending = state.competitions
        .filter(
          (competition) =>
            String(competition.ownerJudokaId) === ownerId &&
            Boolean(competition.competitionDate) &&
            competition.competitionDate <= today &&
            !cleanText(competition.result)
        )
        .sort((a, b) => b.competitionDate.localeCompare(a.competitionDate))[0];
      if (!pending) return null;
      const name = formatCompetitionName(pending.name) || "cette compétition";
      const firstName = ui.normalizeDisplayName(cleanText(owner.firstName)) || getJudokaDisplayName(owner);
      return {
        competitionId: String(pending.competitionId),
        question: mode === "judoka" ? `Quelle place à ${name} ?` : `Quelle place pour ${firstName} à ${name} ?`
      };
    });
    const homeRankingOptions = window.Vue.computed(() =>
      ["1er", "2e", "3e", "5e", "7e", "Non classé"].map((value) => ({
        value,
        medalClass: ui.getClassementBadgeClass(value).replace("rank-finalist", "")
      }))
    );

    function saveHomeRanking(competitionId: string, result: string) {
      app.runServer(
        "finalizeCompetition",
        [competitionId, result],
        (response) => {
          showSuccess(response.message);
          state.competitions = state.competitions.map((competition) =>
            String(competition.competitionId) === String(competitionId) ? { ...competition, result } : competition
          );
          if (response.competition) app.local.saveCompetition(response.competition);
          const viewModel = getHomeViewModel();
          viewModel.homeRankingSavedText = `Classement enregistré : ${result}.`;
          viewModel.homeRankingSavedCompetitionId = competitionId;
        },
        showError
      );
    }
    const showJudokaRoster = window.Vue.computed(
      () => getCurrentMode() === "coachJudoka" && state.judokas.length > 0 && !state.homeFilterJudokaId
    );
    const showChildPills = window.Vue.computed(
      () => (getCurrentMode() === "family" || getCurrentMode() === "parentHome") && childOptions.value.length > 1
    );

    // Les compétitions à venir (date du jour comprise) passent en tête par date croissante,
    // puis les compétitions passées de la plus récente à la plus ancienne.
    function sortUpcomingFirst<T extends { competitionDate: string }>(items: T[], today: string): T[] {
      const upcoming = items
        .filter((item) => item.competitionDate >= today)
        .sort((a, b) => a.competitionDate.localeCompare(b.competitionDate));
      const past = items
        .filter((item) => item.competitionDate < today)
        .sort((a, b) => b.competitionDate.localeCompare(a.competitionDate));
      return [...upcoming, ...past];
    }

    // « aujourd'hui », « demain », « dans 3 jours » ; rien pour une date passée.
    function getWhenLabel(competitionDate: string, today: string): string {
      if (competitionDate < today) return "";
      const label = ui.formatRelativeDay(competitionDate);
      return label ? label.charAt(0).toUpperCase() + label.slice(1) : "";
    }

    // LISTE-2 : deux intertitres, « À venir » et « Passées ».
    function groupByTiming<T extends { isUpcoming: boolean }>(items: T[]) {
      const upcoming = items.filter((item) => item.isUpcoming);
      const past = items.filter((item) => !item.isUpcoming);
      return [
        ...(upcoming.length ? [{ key: "upcoming", title: "À venir", items: upcoming }] : []),
        ...(past.length ? [{ key: "past", title: "Passées", items: past }] : [])
      ];
    }

    // V2 A (UIX-012) : pour l'enfant choisi ou le judoka, la prochaine compétition et le bilan de la saison.
    function getHomeOwner() {
      const mode = getCurrentMode();
      if (mode === "judoka") return state.currentUser;
      if (mode === "family") return getHomeActiveJudoka();
      return null;
    }

    const homeNextCompetition = window.Vue.computed(() => {
      const owner = getHomeOwner();
      if (!owner) return null;
      const today = getTodayStr();
      const next = state.competitions
        .filter((c) => String(c.ownerJudokaId) === String(owner.judokaId) && c.competitionDate >= today)
        .sort((a, b) => a.competitionDate.localeCompare(b.competitionDate))[0];
      if (!next) return null;
      return {
        competitionId: String(next.competitionId),
        name: formatCompetitionName(next.name) || "Compétition",
        dateLabel: ui.formatDateLong(next.competitionDate),
        countdown: ui.formatCountdown(next.competitionDate),
        whenLabel: getWhenLabel(next.competitionDate, today)
      };
    });

    const homeSeasonSummary = window.Vue.computed(() => {
      const owner = getHomeOwner();
      if (!owner) return null;
      const today = getTodayStr();
      const seasonStart = getSeasonStartYear(today);
      const past = state.competitions.filter(
        (c) =>
          String(c.ownerJudokaId) === String(owner.judokaId) &&
          Boolean(c.competitionDate) &&
          c.competitionDate < today &&
          getSeasonStartYear(c.competitionDate) === seasonStart
      );
      const totals = past.reduce(
        (sum, c) => {
          const record = state.combatRecords[String(c.competitionId)];
          if (record) {
            sum.combats += record.total;
            sum.wins += record.wins;
            sum.losses += record.losses;
          }
          if (PODIUM_RESULTS.includes(cleanText(c.result))) sum.podiums += 1;
          return sum;
        },
        { combats: 0, wins: 0, losses: 0, podiums: 0 }
      );
      const isSelf = getCurrentMode() === "judoka";
      const firstName = ui.normalizeDisplayName(cleanText(owner.firstName)) || getJudokaDisplayName(owner);
      return {
        title: isSelf ? "Ma saison" : `La saison de ${firstName}`,
        linkLabel: isSelf ? "Ma fiche" : "Sa fiche",
        hasCompetitions: past.length > 0,
        stats: [
          { key: "competitions", value: past.length, label: past.length > 1 ? "compétitions" : "compétition" },
          { key: "combats", value: totals.combats, label: totals.combats > 1 ? "combats" : "combat" },
          { key: "podiums", value: totals.podiums, label: totals.podiums > 1 ? "podiums" : "podium" }
        ],
        hasRecord: totals.wins + totals.losses > 0,
        wins: totals.wins,
        losses: totals.losses,
        winsLabel: ui.pluralize(totals.wins, "victoire"),
        lossesLabel: ui.pluralize(totals.losses, "défaite")
      };
    });

    // Rond de tête de ligne : médaille dessinée, place, « ? » à saisir, ou rien pour une compétition à venir.
    function getRankDot(result: string, isUpcoming: boolean) {
      if (isUpcoming) return { rankDotLabel: "", rankDotClass: "medal-dot-upcoming" };
      if (!result) return { rankDotLabel: "?", rankDotClass: "medal-dot-pending" };
      const podium = PODIUM_RESULTS.indexOf(result);
      if (podium >= 0) return { rankDotLabel: result.replace(/\D/g, ""), rankDotClass: MEDAL_CLASSES[podium] };
      return { rankDotLabel: /^\d/.test(result) ? result.replace(/\D/g, "") : "NC", rankDotClass: "" };
    }

    const competitionsProjection = window.Vue.computed(() => {
      const today = getTodayStr();
      const mode = getCurrentMode();
      const activeJudokaId = getHomeActiveJudokaId();
      const emptyPage = window.KirokuScreenProjections.paginateList([] as HomeCompetitionCard[], 1, defaultListPageSize);

      if ((mode === "coachJudoka" || mode === "family") && !activeJudokaId) {
        return {
          hasCompetitions: false,
          competitionsEmptyMessage: mode === "family" ? "Aucun enfant n'est rattaché à votre compte." : "Choisissez un judoka.",
          page: emptyPage
        };
      }

      const filteredComps = activeJudokaId
        ? state.competitions.filter((c) => String(c.ownerJudokaId) === String(activeJudokaId))
        : state.competitions;
      // V2 A : la prochaine compétition, déjà mise en avant au-dessus, n'est pas répétée.
      const highlightedId = homeNextCompetition.value?.competitionId || "";
      const sortedComps = sortUpcomingFirst(filteredComps, today).filter((c) => String(c.competitionId) !== highlightedId);

      if (!sortedComps.length) {
        // FAM-1 : sans club, aucun coach ne voit le judoka ni ne peut l'inscrire (CLUB-001).
        const owner = mode === "judoka" ? state.currentUser : getHomeActiveJudoka();
        const hasNoClub = (mode === "family" || mode === "judoka") && owner && !String(owner.clubId || "");
        const emptyMsg =
          mode === "coachJudoka"
            ? "Aucune compétition enregistrée pour ce judoka."
            : hasNoClub && mode === "judoka"
              ? "Vous n'êtes rattaché à aucun club : aucun coach ne peut vous inscrire. Demandez au club de vous rattacher."
              : hasNoClub && owner
                ? `${ui.normalizeDisplayName(cleanText(owner.firstName)) || "Ce judoka"} n'est rattaché à aucun club : aucun coach ne peut l'inscrire. Demandez au club de le rattacher.`
                : "Les compétitions apparaissent ici quand le coach du club y inscrit le judoka.";
        return { hasCompetitions: false, competitionsEmptyMessage: emptyMsg, page: emptyPage };
      }

      const allCompetitions = sortedComps.map((c): HomeCompetitionCard => {
        const isUpcoming = c.competitionDate >= today;
        const record = state.combatRecords[String(c.competitionId)];
        const result = cleanText(c.result || "");
        return {
          competitionId: c.competitionId || "",
          name: formatCompetitionName(c.name) || "Compétition",
          dateLabel: ui.formatDateLong(c.competitionDate),
          whenLabel: getWhenLabel(c.competitionDate, today),
          isUpcoming,
          resultLabel: ui.formatCompetitionRanking(result),
          recordLabel: record && record.total ? ui.formatRecord(record.wins, record.losses, record.draws) : "",
          needsRanking: c.competitionDate < today && !result,
          hasCoachReview: Boolean(c.coachReview),
          ...getRankDot(result, isUpcoming)
        };
      });
      return {
        hasCompetitions: true,
        competitionsEmptyMessage: "",
        page: window.KirokuScreenProjections.paginateList(allCompetitions, state.competitionsCurrentPage, defaultListPageSize)
      };
    });

    const competitionsPage = window.Vue.computed(() => competitionsProjection.value.page);
    const competitionsPaginationRefs = ui.createPaginationRefs(competitionsPage);
    const competitions = competitionsPaginationRefs.page;
    const competitionGroups = window.Vue.computed(() => groupByTiming(competitions.value));
    const hasCompetitions = window.Vue.computed(() => competitionsProjection.value.hasCompetitions);
    const competitionsEmptyMessage = window.Vue.computed(() => competitionsProjection.value.competitionsEmptyMessage);
    const competitionsTotalPages = competitionsPaginationRefs.totalPages;
    const competitionsCurrentPage = competitionsPaginationRefs.currentPage;
    const competitionsTotalCount = competitionsPaginationRefs.totalCount;
    const competitionsCanShowPreviousPage = competitionsPaginationRefs.canShowPreviousPage;
    const competitionsCanShowNextPage = competitionsPaginationRefs.canShowNextPage;

    // PAGE-2 : l'ouverture charge la saison en cours ; une saison passée se charge à la demande.
    function getSeasonStartYear(dateValue: string) {
      const [year, month] = dateValue.split("-").map(Number);
      return (month || 0) >= 9 ? year || 0 : (year || 0) - 1;
    }
    const olderSeasonStartYear = window.Vue.computed(() => {
      if (!state.loadedFrom || !state.oldestCompetitionDate) {
        return 0;
      }
      const loadedYears = [getSeasonStartYear(state.loadedFrom), ...state.loadedSeasonStartYears];
      const previousYear = Math.min(...loadedYears) - 1;
      return getSeasonStartYear(state.oldestCompetitionDate) <= previousYear ? previousYear : 0;
    });
    const olderSeasonLabel = window.Vue.computed(() => {
      const year = olderSeasonStartYear.value;
      return year ? `Voir la saison ${year}-${year + 1}` : "";
    });
    const isLoadingSeason = window.Vue.computed(() => state.isLoadingSeason);

    function loadOlderSeason() {
      const seasonStartYear = olderSeasonStartYear.value;
      if (!seasonStartYear || state.isLoadingSeason) {
        return;
      }
      state.isLoadingSeason = true;
      app.runServer(
        "getSeasonCompetitions",
        [seasonStartYear],
        (season) => {
          state.isLoadingSeason = false;
          app.local.addSeason(season);
        },
        (error) => {
          state.isLoadingSeason = false;
          showError(error);
        }
      );
    }

    // Compétitions club du club sélectionné sur l'accueil (toutes celles du coach sinon).
    function getClubCompetitionsInSelectedClub() {
      return state.selectedClubId
        ? state.clubCompetitions.filter((cc) => String(cc.clubId || "") === state.selectedClubId)
        : state.clubCompetitions;
    }

    const showClubFilter = window.Vue.computed(() => state.isCoach && state.clubs.length > 1);

    // MULTI-1 : sur « Tous mes clubs », chaque ligne dit son club ; un club choisi n'est pas répété.
    function getListClubName(clubId: unknown): string {
      if (state.clubs.length < 2 || state.selectedClubId) return "";
      const club = state.clubs.find((candidate) => candidate.clubId === String(clubId || ""));
      return club ? club.name : "";
    }
    const coachClubOptions = window.Vue.computed(() => state.clubs);
    const selectedClubId = window.Vue.computed(() => state.selectedClubId);

    function selectHomeClub(clubId: string) {
      app.setSelectedClubId(clubId);
      state.clubCompetitionsCurrentPage = 1;
      // Le judoka actif doit appartenir au club choisi.
      const activeId = state.homeFilterJudokaId;
      if (activeId && !getAccessibleHomeJudokas().some((j) => String(j.judokaId) === String(activeId))) {
        state.homeFilterJudokaId = "";
        getHomeViewModel().filterJudokaText = "";
      }
      if (getCurrentMode() === "coachJudoka") refreshJudokaRoster();
    }

    function getClubCompetitionStats(clubCompetitionId: string, competitionDate: string, today: string) {
      const linked = state.competitions.filter(
        (competition) => String(competition.clubCompetitionId || "") === String(clubCompetitionId || "")
      );
      const participantCount = linked.length;
      const rankedCount = linked.filter((competition) => cleanText(competition.result || "")).length;
      const podiumCount = linked.filter((competition) => ["1er", "2e", "3e"].includes(cleanText(competition.result || ""))).length;
      // Un classement se saisit à partir du jour J.
      const missingRankingCount = competitionDate <= today ? participantCount - rankedCount : 0;
      return { participantCount, rankedCount, podiumCount, missingRankingCount };
    }

    const clubCompetitionsProjection = window.Vue.computed(() => {
      const today = getTodayStr();
      const search = cleanText(state.clubCompetitionsSearchText).toLowerCase();
      const sorted = sortUpcomingFirst(getClubCompetitionsInSelectedClub(), today).filter(
        (cc) =>
          !search ||
          String(cc.name || "").toLowerCase().includes(search) ||
          formatDate(cc.competitionDate).includes(search)
      );
      if (!sorted.length) {
        return {
          hasClubCompetitions: false,
          clubCompetitionsEmptyMessage: search
            ? "Aucune compétition ne correspond à cette recherche."
            : "Créez la prochaine compétition et inscrivez les judokas.",
          page: window.KirokuScreenProjections.paginateList([] as HomeClubCompetitionCard[], 1, defaultListPageSize)
        };
      }
      const all = sorted.map((cc): HomeClubCompetitionCard => {
        const stats = getClubCompetitionStats(cc.clubCompetitionId, cc.competitionDate, today);
        const isUpcoming = cc.competitionDate >= today;
        const participants = ui.pluralize(stats.participantCount, "participant");
        // CLUB-3 : compteurs accordés, podiums seulement après la compétition.
        const summary = isUpcoming || !stats.rankedCount
          ? participants
          : `${participants} · ${ui.pluralize(stats.podiumCount, "podium")}`;
        return {
          clubCompetitionId: cc.clubCompetitionId || "",
          name: formatCompetitionName(cc.name) || "Compétition",
          dateLabel: ui.formatDateLong(cc.competitionDate),
          whenLabel: getWhenLabel(cc.competitionDate, today),
          isToday: cc.competitionDate === today,
          isUpcoming,
          summary,
          clubName: getListClubName(cc.clubId),
          missingRankingCount: stats.missingRankingCount,
          missingRankingLabel: `${ui.pluralize(stats.missingRankingCount, "classement")} à saisir`
        };
      });
      return {
        hasClubCompetitions: true,
        clubCompetitionsEmptyMessage: "",
        page: window.KirokuScreenProjections.paginateList(all, state.clubCompetitionsCurrentPage, defaultListPageSize)
      };
    });

    const clubCompetitionsPage = window.Vue.computed(() => clubCompetitionsProjection.value.page);
    const clubCompetitionsPaginationRefs = ui.createPaginationRefs(clubCompetitionsPage);
    const clubCompetitionsList = clubCompetitionsPaginationRefs.page;
    const clubCompetitionGroups = window.Vue.computed(() => groupByTiming(clubCompetitionsList.value));
    const hasClubCompetitions = window.Vue.computed(() => clubCompetitionsProjection.value.hasClubCompetitions);
    const clubCompetitionsEmptyMessage = window.Vue.computed(() => clubCompetitionsProjection.value.clubCompetitionsEmptyMessage);
    const clubCompetitionsTotalPages = clubCompetitionsPaginationRefs.totalPages;
    const clubCompetitionsCurrentPage = clubCompetitionsPaginationRefs.currentPage;
    const clubCompetitionsTotalCount = clubCompetitionsPaginationRefs.totalCount;
    const clubCompetitionsCanShowPreviousPage = clubCompetitionsPaginationRefs.canShowPreviousPage;
    const clubCompetitionsCanShowNextPage = clubCompetitionsPaginationRefs.canShowNextPage;
    const clubCompetitionsSearchText = window.Vue.computed(() => state.clubCompetitionsSearchText);

    function updateClubCompetitionsSearch(value: string) {
      state.clubCompetitionsSearchText = String(value || "");
      state.clubCompetitionsCurrentPage = 1;
    }

    // ACCUEIL-3 (V2 A) : la prochaine compétition, les classements à saisir, les derniers podiums.
    function findJudoka(judokaId: string) {
      return state.judokas.find((j) => String(j.judokaId) === String(judokaId));
    }

    const coachHome = window.Vue.computed(() => {
      const today = getTodayStr();
      const events = getClubCompetitionsInSelectedClub();

      const nextEvent = events
        .filter((cc) => cc.competitionDate >= today)
        .sort((a, b) => a.competitionDate.localeCompare(b.competitionDate))[0];
      let next = null;
      if (nextEvent) {
        const entrants = state.competitions
          .filter((c) => String(c.clubCompetitionId || "") === String(nextEvent.clubCompetitionId))
          .map((c) => findJudoka(c.ownerJudokaId))
          .filter((judoka): judoka is Judoka => Boolean(judoka));
        const count = getClubCompetitionStats(nextEvent.clubCompetitionId, nextEvent.competitionDate, today).participantCount;
        next = {
          clubCompetitionId: nextEvent.clubCompetitionId || "",
          name: formatCompetitionName(nextEvent.name) || "Compétition",
          dateLabel: ui.formatDateLong(nextEvent.competitionDate),
          clubName: getListClubName(nextEvent.clubId),
          countdown: ui.formatCountdown(nextEvent.competitionDate),
          countdownCaption: getWhenLabel(nextEvent.competitionDate, today),
          participantsLabel: `${count} inscrit${count > 1 ? "s" : ""}`,
          avatars: entrants.slice(0, 3).map((judoka) => ({
            judokaId: String(judoka.judokaId),
            initials: ui.getJudokaInitials(judoka)
          })),
          moreCount: Math.max(0, count - 3)
        };
      }

      // COACH-6 : 5 lignes au plus ; le reste est annoncé (« + N autres »).
      const AGENDA_LIMIT = 5;
      const rankingsAll = events
        .filter((cc) => cc.competitionDate <= today)
        .sort((a, b) => b.competitionDate.localeCompare(a.competitionDate))
        .map((cc) => ({ cc, stats: getClubCompetitionStats(cc.clubCompetitionId, cc.competitionDate, today) }))
        .filter(({ stats }) => stats.missingRankingCount > 0);
      const missingTotal = rankingsAll.reduce((sum, { stats }) => sum + stats.missingRankingCount, 0);
      const more = rankingsAll.length - AGENDA_LIMIT;
      const todo = {
        total: missingTotal,
        items: rankingsAll.slice(0, AGENDA_LIMIT).map(({ cc, stats }) => ({
          clubCompetitionId: cc.clubCompetitionId || "",
          name: formatCompetitionName(cc.name) || "Compétition",
          dateLabel: cc.competitionDate === today ? "Aujourd'hui" : ui.formatDateLong(cc.competitionDate),
          clubName: getListClubName(cc.clubId),
          detail: `${ui.pluralize(stats.missingRankingCount, "classement")} à saisir`
        })),
        moreLabel: more > 0 ? `+ ${more} ${more > 1 ? "autres" : "autre"} dans « Compétitions »` : ""
      };

      const eventById = new Map(events.map((cc) => [String(cc.clubCompetitionId), cc]));
      const podiums = state.competitions
        .filter((c) => eventById.has(String(c.clubCompetitionId || "")) && PODIUM_RESULTS.includes(cleanText(c.result)))
        .filter((c) => c.competitionDate <= today)
        .sort(
          (a, b) =>
            b.competitionDate.localeCompare(a.competitionDate) ||
            PODIUM_RESULTS.indexOf(cleanText(a.result)) - PODIUM_RESULTS.indexOf(cleanText(b.result))
        )
        .slice(0, 3)
        .map((c) => {
          const judoka = findJudoka(c.ownerJudokaId);
          const result = cleanText(c.result);
          return {
            competitionId: String(c.competitionId),
            name: judoka ? getJudokaDisplayName(judoka) : "Judoka",
            beltBackground: ui.getBeltBackground(judoka?.beltColor),
            detail: `${formatCompetitionName(c.name) || "Compétition"} · ${result}`,
            rank: result.replace(/\D/g, ""),
            medalClass: MEDAL_CLASSES[PODIUM_RESULTS.indexOf(result)]
          };
        });

      const firstName = ui.normalizeDisplayName(cleanText(state.currentUser?.firstName));
      const hello = new Date().getHours() >= 18 ? "Bonsoir" : "Bonjour";
      const summary = missingTotal
        ? `${ui.pluralize(missingTotal, "classement")} ${missingTotal > 1 ? "vous attendent" : "vous attend"}`
        : "Tous les classements sont saisis";
      return {
        greeting: firstName ? `${hello} ${firstName}` : hello,
        summary,
        next,
        todo,
        podiums,
        isEmpty: !next && !todo.items.length
      };
    });

    function ensureHomeViewModel() {
      if (homeViewModelRef) return;

      const homeActions = {
        openClubCompetition: screens.competition.openClubCompetition,
        openCompetition: screens.competition.openCompetition,
        openHomeJudokaProfile,
        selectFilterJudoka,
        saveHomeRanking,
        setHomeMode,
        handleModeTabClick,
        isPrimaryModeActive,
        openCoachCompetitionsHub,
        updateClubCompetitionsSearch,
        selectHomeClub,
        showClubCompetitionForm: screens.competition.showClubCompetitionForm,
        showHomeFilterOptions,
        hideHomeFilterOptions,
        showCompetitionsPreviousPage,
        showCompetitionsNextPage,
        loadOlderSeason,
        showClubCompetitionsPreviousPage,
        showClubCompetitionsNextPage,
        updateFilterJudokaText
      };
      const homeComputedRefs = {
        availableModes,
        coachSubModes,
        showModeTabs,
        showCoachSubTabs,
        currentHomeMode,
        canFilterByJudoka,
        homeRegistrationNotice,
        canCreateClubCompetition,
        canOpenJudokaProfile,
        showCoachHub,
        showClubCompetitionsSection,
        showHomeHero,
        showHomeActions,
        showChildPills,
        showJudokaRoster,
        homePendingRanking,
        homeRankingOptions,
        homeNextCompetition,
        homeSeasonSummary,
        childOptions,
        coachHome,
        isHomeReady,
        isSubmitting,
        actionDisabled,
        homeFilterLabel,
        filterPlaceholder,
        profileButtonText,
        showCompetitionsSection,
        filterJudokaId,
        competitionGroups,
        hasCompetitions,
        competitionsEmptyMessage,
        competitionsTotalPages,
        competitionsCurrentPage,
        competitionsTotalCount,
        competitionsCanShowPreviousPage,
        competitionsCanShowNextPage,
        olderSeasonLabel,
        isLoadingSeason,
        clubCompetitionGroups,
        hasClubCompetitions,
        clubCompetitionsEmptyMessage,
        clubCompetitionsTotalPages,
        clubCompetitionsCurrentPage,
        clubCompetitionsTotalCount,
        clubCompetitionsCanShowPreviousPage,
        clubCompetitionsCanShowNextPage,
        clubCompetitionsSearchText,
        showClubFilter,
        coachClubOptions,
        selectedClubId
      };
      homeViewModelRef = ui.createMountedViewModel("homeView", defaultHomeViewState, homeActions, homeComputedRefs);
    }

    function applyInitialData() {
      ensureHomeViewModel();
      if (getCurrentMode() === "parentHome") {
        state.homeMode = "family";
      }
      if (state.isCoach && getCurrentMode() === "judoka") {
        state.homeMode = "coachHome";
      } else if (state.isParent && getCurrentMode() === "judoka" && state.currentUser?.profileType === "PARENT") {
        state.homeMode = "family";
      }
      if (getCurrentMode() === "judoka") {
        getHomeViewModel().filterJudokaText = "";
      }
      ensureHomeActiveJudokaSelection();
    }

    const AGE_CATEGORY_ORDER = ["Poussinet", "Poussin", "Benjamin", "Minime", "Cadet", "Junior", "Senior", "Vétéran"];

    function getAgeCategoryOrder(ageCategory: string): number {
      const index = AGE_CATEGORY_ORDER.indexOf(ageCategory);
      return index === -1 ? AGE_CATEGORY_ORDER.length : index;
    }

    function getHomeFilterOption(judoka: Judoka): HomeFilterOption {
      const isUnregistered = !ui.isRegisteredForDate(judoka, ui.getCurrentLocalDate());
      const clubNames = ui.getJudokaClubIds(judoka).map(getListClubName).filter(Boolean).join(", ");
      const details = [judoka.ageCategory, ui.formatWeight(judoka.weightCategory), clubNames]
        .map((value) => cleanText(value))
        .filter(Boolean)
        .join(" · ");
      return {
        judokaId: String(judoka.judokaId || ""),
        name: getJudokaDisplayName(judoka) || "Judoka",
        // INSCR-2 : le coach voit qui n'est pas réinscrit pour la saison en cours.
        meta: [details, isUnregistered ? "Non réinscrit" : ""].filter(Boolean).join(" · "),
        details,
        isUnregistered,
        ageCategory: cleanText(judoka.ageCategory),
        searchText: `${getJudokaDisplayName(judoka)} ${judoka.ageCategory || ""}`.toLowerCase()
      };
    }

    function refreshHomeFilterOptions(queryOverride?: string) {
      const viewModel = getHomeViewModel();
      const query =
        queryOverride !== undefined
          ? cleanText(queryOverride).toLowerCase()
          : cleanText(viewModel.filterJudokaText).toLowerCase();
      // Options regroupées par catégorie d'âge (ordre sportif), puis par nom.
      viewModel.filterOptions = getAccessibleHomeJudokas()
        .map(getHomeFilterOption)
        .filter((option) => !query || option.searchText.includes(query))
        .sort(
          (a, b) =>
            getAgeCategoryOrder(a.ageCategory) - getAgeCategoryOrder(b.ageCategory) ||
            a.name.localeCompare(b.name, "fr")
        );
    }

    function showHomeFilterOptions() {
      if (hideFilterOptionsTimer) {
        window.clearTimeout(hideFilterOptionsTimer);
        hideFilterOptionsTimer = null;
      }
      // Judoka déjà choisi : toute la liste ; sinon, la recherche en cours.
      refreshHomeFilterOptions(state.homeFilterJudokaId ? "" : undefined);
      getHomeViewModel().showFilterOptions = true;
    }

    function hideHomeFilterOptions() {
      if (hideFilterOptionsTimer) {
        window.clearTimeout(hideFilterOptionsTimer);
      }
      hideFilterOptionsTimer = window.setTimeout(() => {
        const homeViewModel = getHomeViewModel();
        homeViewModel.showFilterOptions = false;
        hideFilterOptionsTimer = null;
      }, 120);
    }

    function updateFilterJudokaText() {
      const viewModel = getHomeViewModel();
      state.homeFilterJudokaId = "";
      viewModel.judokaRosterPage = 1;
      refreshHomeFilterOptions();
      viewModel.showFilterOptions = true;
      state.competitionsCurrentPage = 1;
    }

    function selectFilterJudoka(option: { judokaId: string; name: string } | null) {
      if (hideFilterOptionsTimer) {
        window.clearTimeout(hideFilterOptionsTimer);
        hideFilterOptionsTimer = null;
      }
      const viewModel = getHomeViewModel();
      viewModel.homeRankingSavedText = "";
      state.homeFilterJudokaId = option ? option.judokaId : "";
      viewModel.filterJudokaText = option ? option.name : "";
      if (option && getCurrentMode() === "family") {
        rememberChild(option.judokaId);
      }
      viewModel.showFilterOptions = false;
      state.competitionsCurrentPage = 1;
      // Met à jour l'adresse (paramètre judoka) pour qu'un rechargement garde ce judoka.
      showView("homeView", { replace: true, preserveScroll: true });
    }

    function showCompetitionsPreviousPage() {
      state.competitionsCurrentPage = Math.max(state.competitionsCurrentPage - 1, 1);
    }

    function showCompetitionsNextPage() {
      state.competitionsCurrentPage += 1;
    }

    function showClubCompetitionsPreviousPage() {
      state.clubCompetitionsCurrentPage = Math.max(state.clubCompetitionsCurrentPage - 1, 1);
    }

    function showClubCompetitionsNextPage() {
      state.clubCompetitionsCurrentPage += 1;
    }

    function syncHomeFilterDisplay() {
      const selectedId = state.homeFilterJudokaId;
      if (selectedId && homeViewModelRef) {
        const judoka = state.judokas.find((j) => String(j.judokaId) === String(selectedId));
        homeViewModelRef.filterJudokaText = judoka ? getJudokaDisplayName(judoka) : "";
      }
    }

    function showHome() {
      state.currentCompetition = null;
      state.currentCombats = [];
      state.currentJudokaProfile = null;
      state.canEditCurrentCompetition = false;
      syncHomeFilterDisplay();
      showView("homeView");
    }

    return {
      applyInitialData,
      getAccessibleHomeJudokas,
      getHomeActiveJudoka,
      getHomeActiveJudokaId,
      openHomeJudokaProfile,
      selectFilterJudoka,
      setHomeMode,
      showHome,
      hideHomeFilterOptions,
      showHomeFilterOptions,
      showCompetitionsPreviousPage,
      showCompetitionsNextPage,
      showClubCompetitionsPreviousPage,
      showClubCompetitionsNextPage
    };
  }

  window.createKirokuHomeScreen = createKirokuHomeScreen;
})();
