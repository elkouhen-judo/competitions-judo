(() => {
  function createKirokuCompetitionScreen(app) {
    const { state, ui, notifications } = app;
    const {
      $,
      cleanText,
      emptyState,
      escapeAttribute,
      escapeHtml,
      formatDate,
      formatResultat,
      getCurrentLocalDate,
      getJudokaDisplayName,
      icons,
      normalizeDisplayName,
      setHidden,
      setValue,
      toInputDate,
      showView
    } = ui;
    const {
      clearMessage,
      showError,
      showSuccess
    } = notifications;
    const defaultCompetitionDetailViewState = {
      competitionTitle: "Compétition",
      competitionSubtitle: "",
      competitionDate: "",
      ageWeightLabel: "",
      competitionResult: "",
      canEditCompetition: false,
      canFinalizeCompetition: false,
      combatsHtml: ""
    };
    const defaultCompetitionForm = {
      competitionId: "",
      name: "",
      competitionDate: "",
      ageCategory: "",
      weightCategory: "",
      result: ""
    };
    const defaultCompetitionFormViewState = {
      competitionFormTitle: "Compétition",
      showCompetitionResultBlock: false,
      competitionForm: { ...defaultCompetitionForm }
    };
    const defaultCompetitionFinalizationViewState = {
      finalizationSubtitle: "",
      finalizationForm: {
        competitionId: "",
        result: ""
      }
    };
    const defaultCombatForm = {
      combatId: "",
      opponent: "",
      result: "",
      victoryType: "",
      notes: ""
    };
    const defaultCombatFormViewState = {
      combatFormTitle: "Ajouter un combat",
      combatFormSubtitle: "Combat de la compétition en cours",
      saveCombatButtonText: "Ajouter le combat",
      showCombatDecisionBlock: false,
      combatDecisionOptions: [],
      combatForm: { ...defaultCombatForm }
    };
    let competitionDetailViewModel = null;
    let competitionFormViewModel = null;
    let competitionFinalizationViewModel = null;
    let combatFormViewModel = null;

    function ensureCompetitionDetailViewModel() {
      if (!window.Vue || competitionDetailViewModel) {
        return;
      }

      competitionDetailViewModel = window.Vue.reactive({ ...defaultCompetitionDetailViewState });

      window.Vue.createApp({
        setup() {
          return {
            ...window.Vue.toRefs(competitionDetailViewModel),
            deleteCurrentCompetition,
            editCurrentCompetition,
            showCombatForm,
            showCompetitionFinalizationForm,
            showHome: () => app.showHome()
          };
        }
      }).mount("#competitionView");
    }

    function ensureCompetitionFormViewModel() {
      if (!window.Vue || competitionFormViewModel) {
        return;
      }

      competitionFormViewModel = window.Vue.reactive({
        ...defaultCompetitionFormViewState,
        competitionForm: { ...defaultCompetitionForm }
      });

      window.Vue.createApp({
        setup() {
          return {
            ...window.Vue.toRefs(competitionFormViewModel),
            cancelCompetitionForm,
            saveCompetition
          };
        }
      }).mount("#competitionFormView");
    }

    function ensureCompetitionFinalizationViewModel() {
      if (!window.Vue || competitionFinalizationViewModel) {
        return;
      }

      competitionFinalizationViewModel = window.Vue.reactive({
        ...defaultCompetitionFinalizationViewState,
        finalizationForm: { ...defaultCompetitionFinalizationViewState.finalizationForm }
      });

      window.Vue.createApp({
        setup() {
          return {
            ...window.Vue.toRefs(competitionFinalizationViewModel),
            cancelCompetitionFinalizationForm,
            finalizeCompetition
          };
        }
      }).mount("#competitionFinalizationView");
    }

    function ensureCombatFormViewModel() {
      if (!window.Vue || combatFormViewModel) {
        return;
      }

      combatFormViewModel = window.Vue.reactive({
        ...defaultCombatFormViewState,
        combatForm: { ...defaultCombatForm }
      });

      window.Vue.createApp({
        setup() {
          return {
            ...window.Vue.toRefs(combatFormViewModel),
            cancelCombatForm,
            saveCombat,
            syncCombatDecisionVisibility
          };
        }
      }).mount("#combatFormView");
    }

    function openCompetition(id, keepMessage) {
      if (!keepMessage) {
        clearMessage();
      }
      ensureCompetitionDetailViewModel();
      Object.assign(competitionDetailViewModel, {
        competitionTitle: "Chargement...",
        competitionSubtitle: "",
        competitionDate: "",
        ageWeightLabel: "",
        competitionResult: "",
        canEditCompetition: false,
        canFinalizeCompetition: false,
        combatsHtml: emptyState("Chargement des combats...")
      });
      showView("competitionView");

      app.runServer(
        "getCompetitionDetail",
        [id],
        data => {
          state.currentCompetition = data.competition;
          state.currentCombats = Array.isArray(data.combats) ? data.combats : [];
          state.judokas = Array.isArray(data.judokas) ? data.judokas : [];
          state.canEditCurrentCompetition = Boolean(data.canEditCompetition);

          renderCompetitionDetail();
          renderCombats();
        },
        showError
      );
    }

    function renderCompetitionDetail() {
      ensureCompetitionDetailViewModel();
      const agePoids = [state.currentCompetition.ageCategory, state.currentCompetition.weightCategory].filter(Boolean).join(" - ");
      const hasResult = Boolean(String(state.currentCompetition.result || "").trim());

      Object.assign(competitionDetailViewModel, {
        competitionTitle: state.currentCompetition.name || "Compétition",
        competitionSubtitle: "Détail de la compétition",
        competitionDate: formatDate(state.currentCompetition.competitionDate),
        ageWeightLabel: agePoids,
        competitionResult: state.currentCompetition.result || "",
        canEditCompetition: state.canEditCurrentCompetition,
        canFinalizeCompetition: state.canEditCurrentCompetition && !hasResult
      });
    }

    function editCurrentCompetition() {
      if (!state.currentCompetition) {
        showError({ message: "Compétition introuvable." });
        return;
      }

      showCompetitionForm(state.currentCompetition.competitionId);
    }

    function renderCombats() {
      ensureCompetitionDetailViewModel();

      if (!state.currentCombats.length) {
        competitionDetailViewModel.combatsHtml = emptyState("Aucun combat pour cette compétition.");
        return;
      }

      let html = `<div class="list">`;

      state.currentCombats.forEach(c => {
        html += `
          <article class="card combat-card">
            <div class="combat-header">
              <p class="card-title">${escapeHtml(c.opponent || "Adversaire non renseigné")}</p>
              <div style="display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end;">
                <span class="result-badge result-${escapeAttribute(String(c.result || "").toLowerCase())}">${formatResultat(c.result)}</span>
                ${c.victoryType ? `<span class="result-badge" style="background: var(--line); border-color: var(--muted);">${escapeHtml(c.victoryType)}</span>` : ""}
              </div>
            </div>
            ${state.isAdmin ? `
              <div class="meta-row">
                <span class="meta-label">Judoka</span>
                <span class="meta-value">${escapeHtml(normalizeDisplayName(c.judokaDisplayName || ""))}</span>
              </div>
            ` : ""}
            <p class="combat-comment">${escapeHtml(c.notes || "Aucun déroulé renseigné")}</p>
            <div class="card-actions">
              <button class="button-secondary" type="button" data-id="${escapeAttribute(c.combatId)}" onclick="showCombatForm(this.dataset.id)">
                ${icons.edit}
                Modifier
              </button>
              <button class="button-danger" type="button" data-id="${escapeAttribute(c.combatId)}" onclick="deleteCombat(this.dataset.id)">
                ${icons.trash}
                Supprimer
              </button>
            </div>
          </article>
        `;
      });

      html += `</div>`;
      competitionDetailViewModel.combatsHtml = html;
    }

    function showCompetitionForm(id) {
      clearMessage();
      ensureCompetitionFormViewModel();
      state.previousView = state.currentCompetition ? "competitionView" : "homeView";

      if (id) {
        const c = state.competitions.find(x => String(x.competitionId) === String(id)) || state.currentCompetition;

        if (!c) {
          showError({ message: "Compétition introuvable." });
          return;
        }

        competitionFormViewModel.competitionFormTitle = "Modifier la compétition";
        setCompetitionOwnerField(c.ownerJudokaId || "");
        Object.assign(competitionFormViewModel.competitionForm, {
          competitionId: c.competitionId || "",
          name: c.name || "",
          competitionDate: toInputDate(c.competitionDate),
          ageCategory: c.ageCategory || "",
          weightCategory: c.weightCategory || "",
          result: c.result || ""
        });
        competitionFormViewModel.showCompetitionResultBlock = true;
      } else {
        state.previousView = "homeView";
        competitionFormViewModel.competitionFormTitle = "Ajouter une compétition";
        setCompetitionOwnerField(app.screens.home.getHomeActiveJudokaId());
        Object.assign(competitionFormViewModel.competitionForm, {
          ...defaultCompetitionForm,
          competitionDate: getCurrentLocalDate()
        });
        competitionFormViewModel.showCompetitionResultBlock = false;
      }

      showView("competitionFormView");
    }

    function cancelCompetitionForm() {
      showView(state.previousView || "homeView");
    }

    function getCompetitionOwnerRequiredMessage() {
      return state.isAdmin
        ? "Sélectionnez un judoka avant d'enregistrer la compétition."
        : "Sélectionnez votre profil ou l'un de vos enfants avant d'enregistrer la compétition.";
    }

    function saveCompetition() {
      ensureCompetitionFormViewModel();
      const competition = {
        competitionId: competitionFormViewModel.competitionForm.competitionId,
        name: competitionFormViewModel.competitionForm.name,
        competitionDate: competitionFormViewModel.competitionForm.competitionDate,
        ageCategory: competitionFormViewModel.competitionForm.ageCategory,
        weightCategory: competitionFormViewModel.competitionForm.weightCategory,
        result: competitionFormViewModel.competitionForm.result
      };

      if (state.isAdmin || state.isParent) {
        competition.ownerJudokaId = resolveCompetitionOwnerSelection();
        if (!competition.ownerJudokaId) {
          showError({ message: getCompetitionOwnerRequiredMessage() });
          return;
        }
      }

      app.runServer(
        "saveCompetition",
        [competition],
        response => {
          showSuccess(response.message);
          app.reloadInitialData(response.competitionId);
        },
        showError
      );
    }

    function showCompetitionFinalizationForm() {
      clearMessage();
      ensureCompetitionFinalizationViewModel();
      if (!state.currentCompetition) {
        showError({ message: "Compétition introuvable." });
        return;
      }

      competitionFinalizationViewModel.finalizationSubtitle = state.currentCompetition.name || "";
      Object.assign(competitionFinalizationViewModel.finalizationForm, {
        competitionId: state.currentCompetition.competitionId || "",
        result: state.currentCompetition.result || ""
      });
      showView("competitionFinalizationView");
    }

    function cancelCompetitionFinalizationForm() {
      showView("competitionView");
    }

    function finalizeCompetition() {
      ensureCompetitionFinalizationViewModel();
      const competitionId = competitionFinalizationViewModel.finalizationForm.competitionId;
      const result = competitionFinalizationViewModel.finalizationForm.result;

      app.runServer(
        "finalizeCompetition",
        [competitionId, result],
        response => {
          showSuccess(response.message);
          openCompetition(response.competitionId || competitionId, true);
        },
        showError
      );
    }

    function showCombatForm(id) {
      clearMessage();
      ensureCombatFormViewModel();
      resetCombatForm();
      const combatId = id && typeof id === "object" && "type" in id ? "" : id;

      if (combatId) {
        const combat = state.currentCombats.find(c => String(c.combatId) === String(combatId));

        if (!combat) {
          showError({ message: "Combat introuvable." });
          return;
        }

        Object.assign(combatFormViewModel, {
          combatFormTitle: "Modifier le combat",
          combatFormSubtitle: state.currentCompetition.name || "",
          saveCombatButtonText: "Enregistrer le combat"
        });
        Object.assign(combatFormViewModel.combatForm, {
          combatId: combat.combatId || "",
          opponent: combat.opponent || "",
          result: combat.result || "",
          victoryType: combat.victoryType || "",
          notes: combat.notes || ""
        });
        syncCombatDecisionVisibility(false);
      } else {
        Object.assign(combatFormViewModel, {
          combatFormTitle: "Ajouter un combat",
          combatFormSubtitle: state.currentCompetition.name || ""
        });
        syncCombatDecisionVisibility(true);
      }

      showView("combatFormView");
      window.Vue.nextTick(() => $("combat_adversaire").focus());
    }

    function cancelCombatForm() {
      resetCombatForm();
      showView("competitionView");
    }

    function saveCombat() {
      ensureCombatFormViewModel();
      const idCombat = combatFormViewModel.combatForm.combatId;

      if (idCombat) {
        updateCombat(idCombat);
      } else {
        addCombat();
      }
    }

    function addCombat() {
      if (!state.currentCompetition) {
        showError({ message: "Ouvre une compétition avant d'ajouter un combat." });
        return;
      }

      const combat = getCombatFormValue();

      app.runServer(
        "ajouterCombat",
        [combat],
        response => {
          showSuccess(response.message);
          resetCombatForm();
          openCompetition(state.currentCompetition.competitionId, true);
        },
        showError
      );
    }

    function updateCombat(idCombat) {
      const combat = getCombatFormValue();
      combat.combatId = idCombat;

      app.runServer(
        "updateCombat",
        [combat],
        response => {
          showSuccess(response.message);
          resetCombatForm();
          openCompetition(state.currentCompetition.competitionId, true);
        },
        showError
      );
    }

    function getCombatFormValue() {
      ensureCombatFormViewModel();
      const result = combatFormViewModel.combatForm.result;
      return {
        competitionId: state.currentCompetition.competitionId,
        judokaId: state.currentCompetition.ownerJudokaId,
        opponent: combatFormViewModel.combatForm.opponent,
        result,
        victoryType: result === "Egalité" ? "Hiki wake" : combatFormViewModel.combatForm.victoryType,
        notes: combatFormViewModel.combatForm.notes
      };
    }

    function deleteCurrentCompetition() {
      if (!state.currentCompetition) return;

      const label = state.currentCompetition.name ? ` "${state.currentCompetition.name}"` : "";
      app.confirmAndRun({
        message: `Supprimer la compétition${label} et tous ses combats ?`,
        method: "deleteCompetition",
        args: [state.currentCompetition.competitionId],
        onSuccess: response => {
          showSuccess(response.message);
          state.currentCompetition = null;
          app.reloadInitialData();
        }
      });
    }

    function deleteCompetitionFromList(id, name) {
      const label = name ? ` "${name}"` : "";
      app.confirmAndRun({
        message: `Supprimer la compétition${label} et tous ses combats ?`,
        method: "deleteCompetition",
        args: [id],
        onSuccess: response => {
          showSuccess(response.message);
          app.reloadInitialData();
        }
      });
    }

    function deleteCombat(id) {
      app.confirmAndRun({
        message: "Supprimer ce combat ?",
        method: "deleteCombat",
        args: [id],
        onSuccess: response => {
          showSuccess(response.message);
          openCompetition(state.currentCompetition.competitionId, true);
        }
      });
    }

    function normalizeJudokaSelectionKey(value) {
      return String(value || "")
        .trim()
        .replace(/\s+/g, " ")
        .toLocaleLowerCase("fr-FR");
    }

    function resolveCompetitionOwnerSelection() {
      const hidden = $("competition_id_judoka");
      const input = $("competition_judoka_text");
      const hiddenValue = String(hidden.value || "").trim();

      if (hiddenValue && state.judokas.some(j => String(j.judokaId) === hiddenValue)) {
        return hiddenValue;
      }

      const typedValue = normalizeJudokaSelectionKey(input.value);
      if (!typedValue) {
        const activeJudokaId = String(app.screens.home.getHomeActiveJudokaId() || "").trim();
        if (activeJudokaId && state.judokas.some(j => String(j.judokaId) === activeJudokaId)) {
          hidden.value = activeJudokaId;
          return activeJudokaId;
        }
        return "";
      }

      const matches = state.judokas.filter(j => {
        return [
          getJudokaDisplayName(j),
          ui.getCompactJudokaLabel(j),
          j && j.judokaId
        ].some(label => normalizeJudokaSelectionKey(label) === typedValue);
      });

      if (matches.length === 1) {
        const resolvedId = String(matches[0].judokaId || "");
        hidden.value = resolvedId;
        input.value = getJudokaDisplayName(matches[0]);
        return resolvedId;
      }

      return "";
    }

    function bindAutocomplete({ inputId, dropdownId, hiddenId, getItems, allowBlank, onChange }) {
      const input = $(inputId);
      const dropdown = $(dropdownId);
      const hidden = $(hiddenId);
      let isSelecting = false;

      function select(value, label) {
        input.value = label;
        hidden.value = value;
        dropdown.style.display = "none";
        isSelecting = false;
        onChange && onChange(value ? getItems().find(j => String(j.judokaId) === String(value)) : null);
      }

      function renderOptions(items) {
        dropdown.innerHTML = "";

        if (allowBlank) {
          const opt = document.createElement("div");
          opt.className = "autocomplete-option";
          opt.textContent = "— Tous —";
          opt.addEventListener("pointerdown", e => { e.preventDefault(); isSelecting = true; select("", ""); });
          dropdown.appendChild(opt);
        }

        if (!items.length) {
          const empty = document.createElement("div");
          empty.className = "autocomplete-empty";
          empty.textContent = "Aucun résultat";
          dropdown.appendChild(empty);
        } else {
          items.forEach(j => {
            const name = getJudokaDisplayName(j);
            const secondary = getJudokaSecondaryText(j);
            const opt = document.createElement("div");
            opt.className = "autocomplete-option";
            opt.innerHTML = `<div class="autocomplete-option-copy"><strong>${escapeHtml(name)}</strong><span class="autocomplete-option-meta">${escapeHtml(secondary)}</span></div>`;
            opt.addEventListener("pointerdown", e => { e.preventDefault(); isSelecting = true; select(j.judokaId, name); });
            dropdown.appendChild(opt);
          });
        }

        dropdown.style.display = "block";
      }

      input.addEventListener("focus", () => {
        const q = input.value.toLowerCase().trim();
        renderOptions(getItems().filter(j => !q || getJudokaSearchText(j).includes(q)));
      });

      input.addEventListener("input", () => {
        const q = input.value.toLowerCase().trim();
        hidden.value = "";
        renderOptions(getItems().filter(j => !q || getJudokaSearchText(j).includes(q)));
      });

      input.addEventListener("blur", () => {
        if (!isSelecting) {
          dropdown.style.display = "none";
        }
      });
    }

    function setCompetitionOwnerField(idJudoka) {
      const block = $("competitionOwnerBlock");

      if (!state.isAdmin && !state.isParent) {
        block.classList.add("hidden");
        return;
      }

      block.classList.remove("hidden");

      const input = $("competition_judoka_text");
      if (!input.dataset.bound) {
        bindAutocomplete({
          inputId: "competition_judoka_text",
          dropdownId: "competition_judoka_dropdown",
          hiddenId: "competition_id_judoka",
          getItems: () => state.judokas
        });
        input.dataset.bound = "1";
      }

      const owner = state.judokas.find(j => String(j.judokaId) === String(idJudoka));
      input.value = owner ? getJudokaDisplayName(owner) : "";
      setValue("competition_id_judoka", idJudoka);
    }

    function getJudokaSecondaryText(judoka) {
      if (cleanText(judoka.accountEmail)) {
        return judoka.accountEmail;
      }

      return `ID ${String(judoka.judokaId || "").slice(-6)}`;
    }

    function getJudokaSearchText(judoka) {
      return `${getJudokaDisplayName(judoka)} ${getJudokaSecondaryText(judoka)}`.toLowerCase();
    }

    function getCombatDecisionOptions(result) {
      if (result === "Victoire" || result === "Défaite") {
        return ["Ippon", "Waza-ari", "Yuko", "Décision", "Hansoku-make", "Forfait"];
      }
      if (result === "Egalité") {
        return ["Hiki wake"];
      }
      return [];
    }

    function renderCombatDecisionOptions(result) {
      ensureCombatFormViewModel();
      const options = getCombatDecisionOptions(result);
      const currentValue = combatFormViewModel.combatForm.victoryType;
      combatFormViewModel.combatDecisionOptions = options;

      if (options.includes(currentValue)) {
        combatFormViewModel.combatForm.victoryType = currentValue;
      } else if (result === "Egalité") {
        combatFormViewModel.combatForm.victoryType = "Hiki wake";
      } else {
        combatFormViewModel.combatForm.victoryType = "";
      }
    }

    function syncCombatDecisionVisibility(clearValueWhenHidden) {
      ensureCombatFormViewModel();
      const result = combatFormViewModel.combatForm.result;
      const shouldShow = getCombatDecisionOptions(result).length > 0;
      renderCombatDecisionOptions(result);
      combatFormViewModel.showCombatDecisionBlock = shouldShow;

      if (!shouldShow && clearValueWhenHidden) {
        combatFormViewModel.combatForm.victoryType = "";
      }
    }

    function resetCombatForm() {
      ensureCombatFormViewModel();
      Object.assign(combatFormViewModel.combatForm, defaultCombatForm);
      Object.assign(combatFormViewModel, {
        combatFormTitle: "Ajouter un combat",
        combatFormSubtitle: "Combat de la compétition en cours",
        saveCombatButtonText: "Ajouter le combat"
      });
      syncCombatDecisionVisibility(true);
    }

    function bindEvents() {
      ensureCombatFormViewModel();
    }

    return {
      bindAutocomplete,
      bindEvents,
      cancelCombatForm,
      cancelCompetitionFinalizationForm,
      cancelCompetitionForm,
      deleteCombat,
      deleteCompetitionFromList,
      deleteCurrentCompetition,
      editCurrentCompetition,
      finalizeCompetition,
      getCompetitionOwnerRequiredMessage,
      getJudokaSecondaryText,
      getCombatDecisionOptions,
      openCompetition,
      renderCombatDecisionOptions,
      renderCombats,
      renderCompetitionDetail,
      resolveCompetitionOwnerSelection,
      saveCombat,
      saveCompetition,
      showCombatForm,
      showCompetitionFinalizationForm,
      showCompetitionForm,
      syncCombatDecisionVisibility
    };
  }

  window.createKirokuCompetitionScreen = createKirokuCompetitionScreen;
})();
