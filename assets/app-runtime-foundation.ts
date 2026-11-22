import type { KirokuAppState } from "./types";

function createKirokuInitialState(): KirokuAppState {
  return {
    currentUser: null,
    isAdmin: false,
    isCoach: false,
    isParent: false,
    homeMode: "judoka",
    competitions: [],
    clubCompetitions: [],
    currentCompetition: null,
    judokas: [],
    currentCombats: [],
    currentJudokaProfile: null,
    managedAdmins: [],
    managedUsers: [],
    managedAccessInvitations: [],
    canEditCurrentCompetition: false,
    isLoadingCompetition: false,
    isSubmitting: false,
    isOnline: typeof navigator === "undefined" ? true : navigator.onLine,
    isUsingCachedData: false,
    cachedDataLoadedAt: "",
    pendingRpcKeys: {},
    pendingOperations: [],
    homeFilterJudokaId: "",
    competitionsCurrentPage: 1,
    clubCompetitionsCurrentPage: 1,
    clubCompetitionParticipantsCurrentPage: 1,
    clubCompetitionAvailableJudokasCurrentPage: 1,
    clubCompetitionFormParticipantsCurrentPage: 1,
    judokaCompetitionResultsCurrentPage: 1,
    adminsCurrentPage: 1,
    usersSearch: "",
    usersCurrentPage: 1,
    accessInvitationsCurrentPage: 1
  };
}

function setupKirokuTooltipPositioning() {
  const tooltipSelector = ".tooltip, .info-tip";
  const contentSelector = ".tooltip-content, .info-tip-bubble";
  const viewportPadding = 12;

  const findTooltip = (target: EventTarget | null): HTMLElement | null => {
    if (!(target instanceof Element)) {
      return null;
    }
    const tooltip = target.closest(tooltipSelector);
    return tooltip instanceof HTMLElement ? tooltip : null;
  };

  const syncTooltipPosition = (tooltip: HTMLElement) => {
    const content = tooltip.querySelector(contentSelector);
    if (!(content instanceof HTMLElement)) {
      return;
    }

    tooltip.style.removeProperty("--tooltip-shift-x");
    tooltip.style.removeProperty("--tooltip-arrow-shift-x");
    const rect = content.getBoundingClientRect();
    const rightLimit = window.innerWidth - viewportPadding;
    let shift = 0;

    if (rect.left < viewportPadding) {
      shift = viewportPadding - rect.left;
    } else if (rect.right > rightLimit) {
      shift = rightLimit - rect.right;
    }

    const roundedShift = Math.round(shift);
    tooltip.style.setProperty("--tooltip-shift-x", `${roundedShift}px`);
    tooltip.style.setProperty("--tooltip-arrow-shift-x", `${-roundedShift}px`);
  };

  document.addEventListener("pointerover", (event) => {
    const tooltip = findTooltip(event.target);
    if (tooltip) {
      syncTooltipPosition(tooltip);
    }
  });
  document.addEventListener("focusin", (event) => {
    const tooltip = findTooltip(event.target);
    if (tooltip) {
      syncTooltipPosition(tooltip);
    }
  });
  window.addEventListener("resize", () => {
    document.querySelectorAll<HTMLElement>(tooltipSelector).forEach(syncTooltipPosition);
  });
}

window.createKirokuInitialState = createKirokuInitialState;
window.setupKirokuTooltipPositioning = setupKirokuTooltipPositioning;
