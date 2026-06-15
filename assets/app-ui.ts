(() => {
  const viewIds = [
    "loginView",
    "homeView",
    "judokaView",
    "adminsView",
    "childrenView",
    "competitionView",
    "clubCompetitionFormView",
    "clubCompetitionDetailView",
    "competitionFormView",
    "competitionFinalizationView",
    "combatFormView"
  ] as const;

  type ViewId = (typeof viewIds)[number];
  type ActionMap = Record<string, (...args: unknown[]) => unknown>;

  function $<TElement extends HTMLElement = HTMLElement>(id: string): TElement {
    const element = document.getElementById(id);
    if (!element) {
      throw new Error(`Élément introuvable: ${id}`);
    }

    return element as TElement;
  }

  function normalizeDisplayName(value) {
    const cleaned = String(value || "")
      .trim()
      .toLocaleLowerCase("fr-FR");
    if (!cleaned) {
      return "";
    }

    return cleaned.replace(/(^|[\s'-])(\p{L})/gu, (match, separator, letter) => {
      return separator + letter.toLocaleUpperCase("fr-FR");
    });
  }

  function normalizeLastName(value) {
    return normalizeDisplayName(value).toLocaleUpperCase("fr-FR");
  }

  function getJudokaDisplayName(j) {
    return [normalizeDisplayName(j && j.firstName), normalizeLastName(j && j.lastName)]
      .filter(Boolean)
      .join(" ");
  }

  function getCompactJudokaLabel(j) {
    const firstName = normalizeDisplayName(j && j.firstName);
    const lastName = normalizeLastName(j && j.lastName);
    if (!firstName && !lastName) {
      return "";
    }
    if (!lastName) {
      return firstName;
    }
    return `${firstName} ${lastName.charAt(0)}.`;
  }

  function cleanText(value) {
    return String(value || "").trim();
  }

  function formatDate(value) {
    if (!value) return "";
    const d = new Date(value);
    return isNaN(d.getTime()) ? value : d.toLocaleDateString("fr-FR");
  }

  function toInputDate(value) {
    if (!value) return "";
    const d = new Date(value);
    return isNaN(d.getTime()) ? value : d.toISOString().slice(0, 10);
  }

  function getCurrentLocalDate() {
    const now = new Date();
    const year = String(now.getFullYear());
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function formatResultat(value) {
    if (value === "V" || value === "Victoire") return "Victoire";
    if (value === "D" || value === "Défaite") return "Défaite";
    if (value === "E" || value === "Egalité") return "Egalité";
    if (value === "Disqualification") return "Défaite";
    return value || "";
  }

  function getClassementBadgeClass(value) {
    const normalized = String(value || "").toLowerCase();
    if (normalized === "1er") return "rank-1";
    if (normalized === "2e") return "rank-2";
    if (normalized === "3e") return "rank-3";
    if (normalized === "5e" || normalized === "7e") return "rank-finalist";
    return "";
  }

  function getJudokaInitials(judoka) {
    const firstName = normalizeDisplayName(judoka && judoka.firstName);
    const lastName = normalizeLastName(judoka && judoka.lastName);
    return `${firstName.charAt(0) || ""}${lastName.charAt(0) || ""}`.trim() || "J";
  }

  function formatDateTime(value) {
    if (!value) {
      return "Non renseigné";
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return new Intl.DateTimeFormat("fr-FR", {
      dateStyle: "short",
      timeStyle: "short"
    }).format(date);
  }

  function mountViewModel<TViewModel extends object>(
    id: string,
    viewModel: TViewModel,
    actions: ActionMap = {}
  ): void {
    window.Vue.createApp({
      setup() {
        return {
          ...window.Vue.toRefs(viewModel),
          ...actions
        };
      }
    }).mount(`#${id}`);
  }

  function cloneDefaultState<TValue>(defaultState: TValue): TValue {
    if (typeof structuredClone === "function") {
      return structuredClone(defaultState);
    }

    return JSON.parse(JSON.stringify(defaultState)) as TValue;
  }

  function createMountedViewModel<TViewModel extends object>(
    id: string,
    defaultState: TViewModel,
    actions: ActionMap = {}
  ): TViewModel {
    const viewModel = window.Vue.reactive(cloneDefaultState(defaultState));
    mountViewModel(id, viewModel, actions);
    return viewModel;
  }

  window.KirokuUI = {
    $,
    cleanText,
    formatDate,
    formatDateTime,
    formatResultat,
    getClassementBadgeClass,
    getCompactJudokaLabel,
    getCurrentLocalDate,
    getJudokaDisplayName,
    getJudokaInitials,
    createMountedViewModel,
    mountViewModel,
    normalizeDisplayName,
    normalizeLastName,
    showView() {},
    toInputDate,
    viewIds
  };
})();
