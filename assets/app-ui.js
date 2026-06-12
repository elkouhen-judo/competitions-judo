(() => {
  const viewIds = [
    "loginView",
    "homeView",
    "judokaView",
    "adminsView",
    "childrenView",
    "competitionView",
    "competitionFormView",
    "competitionFinalizationView",
    "combatFormView"
  ];

  const icons = {
    edit: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>`,
    shieldOff: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l7 4v5c0 5-3.5 8-7 9-3.5-1-7-4-7-9V7l7-4z"></path><path d="M9 9l6 6"></path><path d="M15 9l-6 6"></path></svg>`,
    trash: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>`
  };

  function $(id) {
    return document.getElementById(id);
  }

  function setValue(id, value) {
    $(id).value = value || "";
  }

  function getValue(id) {
    return $(id).value;
  }

  function setText(id, value) {
    $(id).innerText = value || "";
  }

  function setTexts(valuesById) {
    Object.entries(valuesById).forEach(([id, value]) => setText(id, value));
  }

  function setValues(valuesById) {
    Object.entries(valuesById).forEach(([id, value]) => setValue(id, value));
  }

  function setHidden(id, hidden) {
    $(id).classList.toggle("hidden", hidden);
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function escapeAttribute(value) {
    return escapeHtml(value).replaceAll("`", "&#096;");
  }

  function emptyState(message) {
    return `<div class="empty-state">${escapeHtml(message)}</div>`;
  }

  function normalizeDisplayName(value) {
    const cleaned = String(value || "").trim().toLocaleLowerCase("fr-FR");
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
    return [normalizeDisplayName(j && j.firstName), normalizeLastName(j && j.lastName)].filter(Boolean).join(" ");
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
    if (value === "V") return "Victoire";
    if (value === "D") return "Défaite";
    if (value === "E") return "Égalité";
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

  window.KirokuUI = {
    $,
    cleanText,
    emptyState,
    escapeAttribute,
    escapeHtml,
    formatDate,
    formatDateTime,
    formatResultat,
    getClassementBadgeClass,
    getCompactJudokaLabel,
    getCurrentLocalDate,
    getJudokaDisplayName,
    getJudokaInitials,
    getValue,
    icons,
    normalizeDisplayName,
    normalizeLastName,
    setHidden,
    setText,
    setTexts,
    setValue,
    setValues,
    toInputDate,
    viewIds
  };
})();
