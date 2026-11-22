(() => {
  type KirokuApp = import("./types").KirokuApp;
  type FfjudoAgendaEvent = import("../core/types").FfjudoAgendaEvent;

  // AGD : valeurs des options « Autre » (ligue inconnue) et « Non précisé » (type absent).
  const OTHER_LIGUE = "__autre__";
  const UNKNOWN_TYPE = "__non_precise__";
  const NATIONAL_LIGUE = "National";
  const UV_OPTIONS = ["UV1", "UV2", "UV3", "UV4"];

  const MONTH_FORMATTER = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" });
  const SYNC_DATE_FORMATTER = new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Europe/Paris"
  });
  const SYNC_TIME_FORMATTER = new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris"
  });

  interface AgendaFilters {
    ligue: string;
    type: string;
    month: string;
    /** AGD-013 : UV cochées, toutes exigées. */
    uvs: string[];
  }

  interface AgendaViewState {
    isLoading: boolean;
    loaded: boolean;
    loadError: string;
    canRetry: boolean;
    lastSyncAt: string;
    events: FfjudoAgendaEvent[];
    filters: AgendaFilters;
  }

  const defaultAgendaViewState: AgendaViewState = {
    isLoading: false,
    loaded: false,
    loadError: "",
    canRetry: true,
    lastSyncAt: "",
    events: [],
    filters: { ligue: "", type: "", month: "", uvs: [] }
  };

  /** « 2026-12-05 » → « 05/12 ». */
  function shortDate(isoDate: string): string {
    const [, month = "", day = ""] = String(isoDate || "").split("-");
    return day && month ? `${day}/${month}` : "";
  }

  function capitalize(value: string): string {
    return value ? value.charAt(0).toLocaleUpperCase("fr-FR") + value.slice(1) : value;
  }

  function monthLabel(monthKey: string): string {
    return MONTH_FORMATTER.format(new Date(`${monthKey}-01T00:00:00Z`));
  }

  // Libellés FFJDA (majuscules sans accents) écrits pour l'écran.
  const TYPE_LABELS: Record<string, string> = {
    COMPETITION: "Compétition",
    "PASSAGE DE GRADE": "Passage de grade",
    STAGE: "Stage",
    FORMATION: "Formation",
    "KATA SPORTIF": "Kata sportif",
    AUTRES: "Autres"
  };

  function typeLabel(type: string): string {
    if (!type) {
      return "Non précisé";
    }
    return TYPE_LABELS[type.toUpperCase()] ?? capitalize(type.toLocaleLowerCase("fr-FR"));
  }

  function ligueValue(event: FfjudoAgendaEvent): string {
    return event.ligue || OTHER_LIGUE;
  }

  function typeValue(event: FfjudoAgendaEvent): string {
    return event.typeEvenement || UNKNOWN_TYPE;
  }

  /** Date du jour à Paris, au format YYYY-MM-DD. */
  function todayInParis(): string {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());
  }

  function toCard(event: FfjudoAgendaEvent, today: string) {
    const place = event.ville || event.lieu;
    const type = event.typeEvenement ? typeLabel(event.typeEvenement) : "";
    const owner = event.proprietaire && event.ligue ? `${event.proprietaire} — ${event.ligue}` : event.proprietaire || event.ligue;
    return {
      uvLabel: (event.uvs || []).join(" · "),
      eventKey: event.eventKey,
      titre: event.titre,
      sourceUrl: event.sourceUrl,
      dateLabel: event.dateFin ? `${shortDate(event.dateDebut)} → ${shortDate(event.dateFin)}` : shortDate(event.dateDebut),
      placeLabel: [place, type].filter(Boolean).join(" · "),
      ownerLabel: owner,
      closingLabel:
        event.inscriptionCloture && event.inscriptionCloture >= today
          ? `Inscriptions jusqu'au ${shortDate(event.inscriptionCloture)}`
          : ""
    };
  }

  function createKirokuFfjudoAgendaScreen(app: KirokuApp) {
    const { ui } = app;
    // L'état réactif existe dès la création : les valeurs calculées le lisent au montage.
    const viewModel: AgendaViewState = window.Vue.reactive({
      ...defaultAgendaViewState,
      events: [],
      filters: { ...defaultAgendaViewState.filters, uvs: [] }
    });
    let mounted = false;
    let requestId = 0;

    const model = () => viewModel;

    const filteredEvents = window.Vue.computed(() => {
      const { events, filters } = model();
      return events.filter(
        (event) =>
          (!filters.ligue || ligueValue(event) === filters.ligue) &&
          (!filters.type || typeValue(event) === filters.type) &&
          (!filters.month || event.dateDebut.slice(0, 7) === filters.month) &&
          filters.uvs.every((uv) => (event.uvs || []).includes(uv))
      );
    });

    const computedRefs = {
      hasEvents: window.Vue.computed(() => model().events.length > 0),
      uvOptions: window.Vue.computed(() => UV_OPTIONS),
      lastSyncLabel: window.Vue.computed(() => {
        const lastSyncAt = model().lastSyncAt;
        if (!lastSyncAt) {
          return model().loaded ? "Pas encore synchronisé" : "";
        }
        const date = new Date(lastSyncAt);
        return `Mis à jour le ${SYNC_DATE_FORMATTER.format(date)} à ${SYNC_TIME_FORMATTER.format(date)}`;
      }),
      ligueOptions: window.Vue.computed(() => {
        const values = [...new Set(model().events.map(ligueValue))];
        const rank = (value: string) => (value === NATIONAL_LIGUE ? 0 : value === OTHER_LIGUE ? 2 : 1);
        return values
          .sort((a, b) => rank(a) - rank(b) || a.localeCompare(b, "fr"))
          .map((value) => ({ value, label: value === OTHER_LIGUE ? "Autre" : value }));
      }),
      typeOptions: window.Vue.computed(() =>
        [...new Set(model().events.map(typeValue))]
          .sort((a, b) => (a === UNKNOWN_TYPE ? 1 : b === UNKNOWN_TYPE ? -1 : a.localeCompare(b, "fr")))
          .map((value) => ({ value, label: value === UNKNOWN_TYPE ? "Non précisé" : typeLabel(value) }))
      ),
      monthOptions: window.Vue.computed(() =>
        [...new Set(model().events.map((event) => event.dateDebut.slice(0, 7)))]
          .sort()
          .map((value) => ({ value, label: monthLabel(value) }))
      ),
      monthGroups: window.Vue.computed(() => {
        const today = todayInParis();
        const groups = new Map<string, ReturnType<typeof toCard>[]>();
        for (const event of filteredEvents.value) {
          const key = event.dateDebut.slice(0, 7);
          groups.set(key, [...(groups.get(key) || []), toCard(event, today)]);
        }
        return [...groups.entries()].map(([key, events]) => ({ key, label: capitalize(monthLabel(key)), events }));
      })
    };

    function ensureViewModel(): AgendaViewState {
      if (!mounted) {
        const actions = {
          showHome: () => app.showHome && app.showHome(),
          retryFfjudoAgenda: () => fetchAgenda(),
          clearFfjudoAgendaFilters,
          toggleFfjudoAgendaUv
        };
        ui.mountViewModel("ffjudoAgendaView", viewModel, actions, computedRefs);
        mounted = true;
      }
      return viewModel;
    }

    function clearFfjudoAgendaFilters() {
      Object.assign(ensureViewModel().filters, { ligue: "", type: "", month: "", uvs: [] });
    }

    function toggleFfjudoAgendaUv(uv: string) {
      const filters = ensureViewModel().filters;
      filters.uvs = filters.uvs.includes(uv) ? filters.uvs.filter((value) => value !== uv) : [...filters.uvs, uv];
    }

    function fetchAgenda() {
      const current = ensureViewModel();
      const id = (requestId += 1);
      current.isLoading = true;
      current.loadError = "";
      app.runServer(
        "getFfjudoEvents",
        [],
        (agenda) => {
          if (id !== requestId) return;
          current.events = Array.isArray(agenda?.events) ? agenda.events : [];
          current.lastSyncAt = String(agenda?.lastSyncAt || "");
          current.loaded = true;
          current.isLoading = false;
        },
        () => {
          if (id !== requestId) return;
          current.isLoading = false;
          current.loadError = app.state.isOnline
            ? "Impossible de charger l'agenda."
            : "L'agenda n'est pas disponible hors connexion.";
        }
      );
    }

    function showFfjudoAgenda() {
      const current = ensureViewModel();
      ui.showView("ffjudoAgendaView");
      // Hors connexion, la liste déjà chargée pendant la session reste affichée.
      if (current.loaded && !app.state.isOnline) {
        return;
      }
      fetchAgenda();
    }

    return { showFfjudoAgenda };
  }

  window.createKirokuFfjudoAgendaScreen = createKirokuFfjudoAgendaScreen;
})();
