(() => {
  type Judoka = import("../core/types").Judoka;

  const viewIds = [
    "loginView",
    "homeView",
    "judokaView",
    "adminsView",
    "coachDashboardView",
    "competitionView",
    "clubCompetitionFormView",
    "clubCompetitionDetailView",
    "competitionFormView",
    "combatFormView"
  ] as const;

  type ActionMap = Record<string, (...args: never[]) => unknown>;
  type ComputedRefMap = import("./types").ComputedRefMap;
  type PaginationResult<T> = import("./types").PaginationResult<T>;

  function $<TElement extends HTMLElement = HTMLElement>(id: string): TElement {
    const element = document.getElementById(id);
    if (!element) {
      throw new Error(`Élément introuvable: ${id}`);
    }

    return element as TElement;
  }

  function normalizeDisplayName(value: unknown) {
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

  function normalizeLastName(value: unknown) {
    return normalizeDisplayName(value).toLocaleUpperCase("fr-FR");
  }

  // UI-3 : un seul format de nom dans toute l'application, « Hugo Durand ».
  function getJudokaDisplayName(j: Partial<Judoka> | null | undefined) {
    return [normalizeDisplayName(j && j.firstName), normalizeDisplayName(j && j.lastName)]
      .filter(Boolean)
      .join(" ");
  }

  function getCompactJudokaLabel(j: Partial<Judoka> | null | undefined) {
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

  function cleanText(value: unknown) {
    return String(value || "").trim();
  }

  function formatDate(value: unknown) {
    if (!value) return "";
    const str = String(value);
    // "YYYY-MM-DD" strings are parsed as UTC by spec; replace dashes to force local-time parsing
    const src = /^\d{4}-\d{2}-\d{2}$/.test(str) ? str.replace(/-/g, "/") : str;
    const d = new Date(src);
    return isNaN(d.getTime()) ? str : d.toLocaleDateString("fr-FR");
  }

  function parseLocalDate(value: unknown): Date | null {
    if (!value) return null;
    const str = String(value);
    const src = /^\d{4}-\d{2}-\d{2}$/.test(str) ? str.replace(/-/g, "/") : str;
    const d = new Date(src);
    return isNaN(d.getTime()) ? null : d;
  }

  // UI-2 : date en clair, « sam. 5 déc. 2026 ».
  function formatDateLong(value: unknown) {
    const d = parseLocalDate(value);
    if (!d) return value ? String(value) : "";
    return new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", month: "short", year: "numeric" }).format(d);
  }

  // Nombre de jours entre aujourd'hui (date locale) et la date donnée ; négatif dans le passé.
  function getDaysFromToday(value: unknown): number | null {
    const d = parseLocalDate(value);
    if (!d) return null;
    const today = parseLocalDate(getCurrentLocalDate()) as Date;
    d.setHours(0, 0, 0, 0);
    return Math.round((d.getTime() - today.getTime()) / 86400000);
  }

  function formatRelativeDay(value: unknown) {
    const days = getDaysFromToday(value);
    if (days === null) return "";
    if (days === 0) return "aujourd'hui";
    if (days === 1) return "demain";
    if (days === -1) return "hier";
    if (days > 1) return `dans ${days} jours`;
    return `il y a ${-days} jours`;
  }

  // « -60kg » → « -60 kg ».
  function formatWeight(value: unknown) {
    return String(value || "")
      .trim()
      .replace(/\s*kg$/i, " kg");
  }

  // Bilan sans compteurs à zéro : « 3V 1D », « 4V ».
  function formatRecord(wins: number, losses: number, draws: number) {
    const parts = [wins ? `${wins}V` : "", losses ? `${losses}D` : "", draws ? `${draws}N` : ""].filter(Boolean);
    return parts.join(" ") || "Aucun combat";
  }

  // UI : accords au pluriel, « 1 participant », « 3 participants ».
  function pluralize(count: number, singular: string, plural?: string) {
    return `${count} ${count > 1 ? plural || `${singular}s` : singular}`;
  }

  function toInputDate(value: unknown) {
    if (!value) return "";
    const str = String(value);
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
    const d = new Date(str);
    if (isNaN(d.getTime())) return str;
    const year = String(d.getFullYear());
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function getCurrentLocalDate() {
    const now = new Date();
    const year = String(now.getFullYear());
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function formatResultat(value: unknown) {
    if (value === "V" || value === "Victoire") return "Victoire";
    if (value === "D" || value === "Défaite") return "Défaite";
    if (value === "E" || value === "Egalité") return "Egalité";
    if (value === "Disqualification") return "Défaite";
    return value ? String(value) : "";
  }

  // Noms de compétition saisis tout en majuscules (ou tout en minuscules) : affichage en casse
  // de titre à la française (« TOURNOI LABEL A CADETS DE LAMBALLE » → « Tournoi Label A Cadets de
  // Lamballe »). Un nom déjà saisi en casse mixte est affiché tel quel.
  const COMPETITION_NAME_SMALL_WORDS = new Set([
    "de", "du", "des", "la", "le", "les", "et", "à", "au", "aux", "en", "sur", "sous", "pour", "par"
  ]);

  function capitalizeWordPart(part: string) {
    return part ? part.charAt(0).toLocaleUpperCase("fr") + part.slice(1) : part;
  }

  // « ille-et-vilaine » → « Ille-et-Vilaine » : les petits mots internes restent en minuscule.
  function capitalizeCompoundWord(word: string) {
    return word
      .split("-")
      .map((part, index) => (index > 0 && COMPETITION_NAME_SMALL_WORDS.has(part) ? part : capitalizeWordPart(part)))
      .join("-");
  }

  function formatCompetitionName(value: unknown) {
    const name = String(value || "").trim().replace(/\s+/g, " ");
    const hasUpper = /\p{Lu}/u.test(name);
    const hasLower = /\p{Ll}/u.test(name);
    if (hasUpper && hasLower) return name;
    return name
      .toLocaleLowerCase("fr")
      .split(" ")
      .map((word, index) => {
        if (index > 0 && COMPETITION_NAME_SMALL_WORDS.has(word)) return word;
        if (/^\p{L}$/u.test(word)) return word.toLocaleUpperCase("fr");
        // d'… / l'… : élision en minuscule, mot suivant capitalisé.
        const elision = /^([dl])(['’])(.+)$/u.exec(word);
        if (elision) {
          const article = index > 0 ? elision[1] : elision[1].toLocaleUpperCase("fr");
          return `${article}${elision[2]}${capitalizeCompoundWord(elision[3])}`;
        }
        return capitalizeCompoundWord(word);
      })
      .join(" ");
  }

  function formatCompetitionRanking(value: unknown) {
    const normalized = String(value || "").trim();
    // Le texte reste lisible sans l'emoji (lecteurs d'écran, polices sans emoji).
    const rankingLabels: Record<string, string> = { "1er": "🥇 1er", "2e": "🥈 2e", "3e": "🥉 3e" };
    return rankingLabels[normalized] || normalized;
  }

  function getClassementBadgeClass(value: unknown) {
    const normalized = String(value || "").toLowerCase();
    if (normalized === "1er") return "rank-1";
    if (normalized === "2e") return "rank-2";
    if (normalized === "3e") return "rank-3";
    if (["4e", "5e", "6e", "7e", "8e"].includes(normalized)) return "rank-finalist";
    return "";
  }

  function getJudokaInitials(judoka: Partial<Judoka> | null | undefined) {
    const firstName = normalizeDisplayName(judoka && judoka.firstName);
    const lastName = normalizeLastName(judoka && judoka.lastName);
    return `${firstName.charAt(0) || ""}${lastName.charAt(0) || ""}`.trim() || "J";
  }

  function formatDateTime(value: unknown) {
    if (!value) {
      return "Non renseigné";
    }

    const date = new Date(value as string | number | Date);
    if (Number.isNaN(date.getTime())) {
      return String(value);
    }

    return new Intl.DateTimeFormat("fr-FR", {
      dateStyle: "short",
      timeStyle: "short"
    }).format(date);
  }

  function mountViewModel<TViewModel extends object>(
    id: string,
    viewModel: TViewModel,
    actions: ActionMap = {},
    computedRefs: ComputedRefMap = {}
  ): void {
    window.Vue.createApp({
      setup() {
        const vmRefs = window.Vue.toRefs(viewModel);
        const conflicts = Object.keys(computedRefs).filter((k) => k in vmRefs);
        if (conflicts.length) {
          console.warn(
            `[KirokuUI] mountViewModel "${id}": computed refs écrasent les refs viewModel : ${conflicts.join(", ")}`
          );
        }
        return {
          ...vmRefs,
          ...computedRefs,
          ...actions
        };
      }
    }).mount(`#${id}`);
  }

  function cloneDefaultState<TValue>(defaultState: TValue): TValue {
    return JSON.parse(JSON.stringify(defaultState));
  }

  function createMountedViewModel<TViewModel extends object>(
    id: string,
    defaultState: TViewModel,
    actions: ActionMap = {},
    computedRefs: ComputedRefMap = {}
  ): TViewModel {
    const viewModel = window.Vue.reactive(cloneDefaultState(defaultState));
    mountViewModel(id, viewModel, actions, computedRefs);
    return viewModel;
  }

  function createPaginationRefs<TItem>(
    pagination: import("./types").ComputedRef<PaginationResult<TItem>>
  ) {
    return {
      page: window.Vue.computed(() => pagination.value.pageItems),
      totalPages: window.Vue.computed(() => pagination.value.totalPages),
      currentPage: window.Vue.computed(() => pagination.value.currentPage),
      totalCount: window.Vue.computed(() => pagination.value.totalItems),
      canShowPreviousPage: window.Vue.computed(() => pagination.value.canShowPreviousPage),
      canShowNextPage: window.Vue.computed(() => pagination.value.canShowNextPage)
    };
  }

  // Les flèches du clavier parcourent un groupe de choix et sélectionnent l'option atteinte.
  function onChoiceKeydown(event: KeyboardEvent) {
    const steps: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
    const isEdgeKey = event.key === "Home" || event.key === "End";
    if (!(event.key in steps) && !isEdgeKey) return;
    const group = event.currentTarget as HTMLElement;
    const radios = Array.from(group.querySelectorAll<HTMLButtonElement>("[role='radio']:not(:disabled)"));
    if (!radios.length) return;
    event.preventDefault();
    const current = radios.indexOf(document.activeElement as HTMLButtonElement);
    let targetIndex = event.key === "Home" ? 0 : radios.length - 1;
    if (!isEdgeKey) {
      const start = current === -1 ? (steps[event.key] > 0 ? -1 : 0) : current;
      targetIndex = (start + steps[event.key] + radios.length) % radios.length;
    }
    const target = radios[targetIndex];
    target.focus();
    target.click();
  }

  window.KirokuUI = {
    $,
    cleanText,
    formatDate,
    formatDateLong,
    formatDateTime,
    formatRecord,
    formatRelativeDay,
    formatWeight,
    getDaysFromToday,
    formatCompetitionName,
    formatCompetitionRanking,
    formatResultat,
    getClassementBadgeClass,
    getCompactJudokaLabel,
    getCurrentLocalDate,
    getJudokaDisplayName,
    getJudokaInitials,
    createMountedViewModel,
    createPaginationRefs,
    mountViewModel,
    normalizeDisplayName,
    normalizeLastName,
    onChoiceKeydown,
    pluralize,
    showView() {},
    toInputDate,
    viewIds
  };
})();
