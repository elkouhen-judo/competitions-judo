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
      getValue,
      icons,
      normalizeDisplayName,
      setHidden,
      setText,
      setTexts,
      setValue,
      setValues,
      toInputDate,
      showView
    } = ui;
    const {
      clearMessage,
      showError,
      showSuccess
    } = notifications;

    function openCompetition(id, keepMessage) {
      if (!keepMessage) {
        clearMessage();
      }
      setTexts({
        competitionTitle: "Chargement...",
        competitionSubtitle: ""
      });
      $("combatsList").innerHTML = emptyState("Chargement des combats...");
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
      setTexts({
        competitionTitle: state.currentCompetition.name || "Compétition",
        competitionSubtitle: "Détail de la compétition",
        competitionDate: formatDate(state.currentCompetition.competitionDate)
      });

      const agePoids = [state.currentCompetition.ageCategory, state.currentCompetition.weightCategory].filter(Boolean).join(" - ");
      setHidden("row_competitionAgePoids", !agePoids);
      setText("competitionAgePoids", agePoids);

      const hasResult = Boolean(String(state.currentCompetition.result || "").trim());
      setHidden("row_competitionClassement", !hasResult);
      setText("competitionClassement", state.currentCompetition.result);

      setHidden("competitionAdminActions", !state.canEditCurrentCompetition);
      setHidden("finalizeCompetitionButton", !state.canEditCurrentCompetition || hasResult);
    }

    function editCurrentCompetition() {
      if (!state.currentCompetition) {
        showError({ message: "Compétition introuvable." });
        return;
      }

      showCompetitionForm(state.currentCompetition.competitionId);
    }

    function renderCombats() {
      const target = $("combatsList");

      if (!state.currentCombats.length) {
        target.innerHTML = emptyState("Aucun combat pour cette compétition.");
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
      target.innerHTML = html;
    }

    function showCompetitionForm(id) {
      clearMessage();
      state.previousView = state.currentCompetition ? "competitionView" : "homeView";

      if (id) {
        const c = state.competitions.find(x => String(x.competitionId) === String(id)) || state.currentCompetition;

        if (!c) {
          showError({ message: "Compétition introuvable." });
          return;
        }

        setText("competitionFormTitle", "Modifier la compétition");
        setCompetitionOwnerField(c.ownerJudokaId || "");
        setValues({
          competition_id: c.competitionId,
          competition_nom: c.name,
          competition_date: toInputDate(c.competitionDate),
          competition_categorie_age: c.ageCategory,
          competition_categorie_poids: c.weightCategory,
          competition_result: c.result
        });
        setHidden("competitionResultBlock", false);
      } else {
        state.previousView = "homeView";
        setText("competitionFormTitle", "Ajouter une compétition");
        setCompetitionOwnerField(app.screens.home.getHomeActiveJudokaId());
        setValues({
          competition_id: "",
          competition_nom: "",
          competition_date: getCurrentLocalDate(),
          competition_categorie_age: "",
          competition_categorie_poids: "",
          competition_result: ""
        });
        setHidden("competitionResultBlock", true);
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
      const competition = {
        competitionId: getValue("competition_id"),
        name: getValue("competition_nom"),
        competitionDate: getValue("competition_date"),
        ageCategory: getValue("competition_categorie_age"),
        weightCategory: getValue("competition_categorie_poids"),
        result: getValue("competition_result")
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
      if (!state.currentCompetition) {
        showError({ message: "Compétition introuvable." });
        return;
      }

      setValue("finalization_competition_id", state.currentCompetition.competitionId);
      setText("competitionFinalizationSubtitle", state.currentCompetition.name);
      setValue("finalization_classement", state.currentCompetition.result);
      showView("competitionFinalizationView");
    }

    function cancelCompetitionFinalizationForm() {
      showView("competitionView");
    }

    function finalizeCompetition() {
      const competitionId = getValue("finalization_competition_id");
      const result = getValue("finalization_classement");

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
      resetCombatForm();

      if (id) {
        const combat = state.currentCombats.find(c => String(c.combatId) === String(id));

        if (!combat) {
          showError({ message: "Combat introuvable." });
          return;
        }

        setTexts({
          combatFormTitle: "Modifier le combat",
          combatFormSubtitle: state.currentCompetition.name,
          saveCombatButtonText: "Enregistrer le combat"
        });
        setValues({
          combat_id: combat.combatId,
          combat_adversaire: combat.opponent,
          combat_resultat: combat.result,
          combat_type_victoire: combat.victoryType,
          combat_deroule: combat.notes
        });
        syncCombatDecisionVisibility(false);
      } else {
        setTexts({
          combatFormTitle: "Ajouter un combat",
          combatFormSubtitle: state.currentCompetition.name
        });
        syncCombatDecisionVisibility(true);
      }

      showView("combatFormView");
      $("combat_adversaire").focus();
    }

    function cancelCombatForm() {
      resetCombatForm();
      showView("competitionView");
    }

    function saveCombat() {
      const idCombat = getValue("combat_id");

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
      const result = getValue("combat_resultat");
      return {
        competitionId: state.currentCompetition.competitionId,
        judokaId: state.currentCompetition.ownerJudokaId,
        opponent: getValue("combat_adversaire"),
        result,
        victoryType: result === "Egalité" ? "Hiki wake" : getValue("combat_type_victoire"),
        notes: getValue("combat_deroule")
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
      const select = $("combat_type_victoire");
      const options = getCombatDecisionOptions(result);
      const currentValue = getValue("combat_type_victoire");
      let html = `<option value="">Non spécifié</option>`;

      options.forEach(option => {
        html += `<option value="${escapeAttribute(option)}">${escapeHtml(option)}</option>`;
      });
      select.innerHTML = html;

      if (options.includes(currentValue)) {
        setValue("combat_type_victoire", currentValue);
      } else if (result === "Egalité") {
        setValue("combat_type_victoire", "Hiki wake");
      } else {
        setValue("combat_type_victoire", "");
      }
    }

    function syncCombatDecisionVisibility(clearValueWhenHidden) {
      const result = getValue("combat_resultat");
      const block = $("combatDecisionBlock");
      const shouldShow = getCombatDecisionOptions(result).length > 0;
      renderCombatDecisionOptions(result);
      block.classList.toggle("hidden", !shouldShow);

      if (!shouldShow && clearValueWhenHidden) {
        setValue("combat_type_victoire", "");
      }
    }

    function resetCombatForm() {
      setValues({
        combat_id: "",
        combat_adversaire: "",
        combat_resultat: "",
        combat_type_victoire: "",
        combat_deroule: ""
      });
      setText("saveCombatButtonText", "Ajouter le combat");
      syncCombatDecisionVisibility(true);
    }

    function bindEvents() {
      $("combat_resultat").addEventListener("change", () => {
        syncCombatDecisionVisibility(true);
      });
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
