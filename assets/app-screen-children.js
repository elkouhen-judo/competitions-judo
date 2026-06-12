(() => {
  function createKirokuChildrenScreen(app) {
    const { state, ui, notifications } = app;
    const {
      $,
      emptyState,
      escapeAttribute,
      escapeHtml,
      getJudokaDisplayName,
      icons,
      normalizeDisplayName,
      normalizeLastName,
      setText,
      setTexts,
      setValue,
      setValues,
      showView
    } = ui;
    const {
      clearMessage,
      showError,
      showSuccess
    } = notifications;

    function showChildrenManagement(keepMessage) {
      if (!keepMessage) {
        clearMessage();
      }

      app.runServer(
        "getChildrenManagement",
        [],
        data => {
          state.managedChildren = Array.isArray(data.children) ? data.children : [];
          renderManagedChildren();
          resetChildForm();
          showView("childrenView");
        },
        showError
      );
    }

    function renderManagedChildren() {
      const target = $("childrenList");
      if (!state.managedChildren.length) {
        target.innerHTML = emptyState("Aucun enfant enregistré pour le moment.");
        return;
      }

      let html = `<div class="list">`;
      state.managedChildren.forEach(child => {
        const fullName = getJudokaDisplayName(child) || "Enfant";
        const directAccessState = child.accountEmail ? "Activée" : "Non activée";
        html += `
          <article class="card child-card">
            <p class="card-title">${escapeHtml(fullName)}</p>
            <div class="card-meta">
              <div class="meta-row">
                <span class="meta-label">Prénom</span>
                <span class="meta-value">${escapeHtml(normalizeDisplayName(child.firstName || ""))}</span>
              </div>
              <div class="meta-row">
                <span class="meta-label">Nom</span>
                <span class="meta-value">${escapeHtml(normalizeLastName(child.lastName || ""))}</span>
              </div>
              <div class="meta-row">
                <span class="meta-label">Email</span>
                <span class="meta-value">${escapeHtml(child.accountEmail || "Non renseigné")}</span>
              </div>
              <div class="meta-row">
                <span class="meta-label">Connexion autonome</span>
                <span class="meta-value">${escapeHtml(directAccessState)}</span>
              </div>
            </div>
            <div class="card-actions">
              <button class="button-secondary" data-id="${escapeAttribute(child.judokaId)}" onclick="editManagedChild(this.dataset.id)">${icons.edit}Modifier</button>
              <button class="button-danger" data-id="${escapeAttribute(child.judokaId)}" data-name="${escapeAttribute(fullName)}" onclick="deleteManagedChild(this.dataset.id, this.dataset.name)">${icons.trash}Supprimer</button>
            </div>
          </article>
        `;
      });
      html += `</div>`;
      target.innerHTML = html;
    }

    function resetChildForm() {
      setValue("child_id", "");
      setValue("child_prenom", "");
      setValue("child_nom", "");
      setValue("child_email", "");
      setText("childFormTitle", "Ajouter un enfant");
      setText("saveChildButtonText", "Ajouter l'enfant");
    }

    function editManagedChild(idJudoka) {
      const child = state.managedChildren.find(item => String(item.judokaId) === String(idJudoka));
      if (!child) {
        showError({ message: "Enfant introuvable." });
        return;
      }

      setValues({
        child_id: child.judokaId,
        child_prenom: child.firstName,
        child_nom: child.lastName,
        child_email: child.accountEmail
      });
      setTexts({
        childFormTitle: "Modifier l'enfant",
        saveChildButtonText: "Enregistrer l'enfant"
      });
      showView("childrenView");
      $("child_prenom").focus();
    }

    function saveManagedChild() {
      const child = {
        judokaId: ui.getValue("child_id"),
        firstName: ui.getValue("child_prenom"),
        lastName: ui.getValue("child_nom"),
        accountEmail: ui.getValue("child_email")
      };

      app.runServer(
        "saveManagedChild",
        [child],
        response => {
          showSuccess(response.message);
          app.reloadInitialDataAndShowChildren();
        },
        showError
      );
    }

    function deleteManagedChild(idJudoka, name) {
      const label = name ? ` "${name}"` : "";
      app.confirmAndRun({
        message: `Supprimer l'enfant${label} ?`,
        method: "deleteManagedChild",
        args: [idJudoka],
        onSuccess: response => {
          showSuccess(response.message);
          app.reloadInitialDataAndShowChildren();
        }
      });
    }

    return {
      deleteManagedChild,
      editManagedChild,
      renderManagedChildren,
      resetChildForm,
      saveManagedChild,
      showChildrenManagement
    };
  }

  window.createKirokuChildrenScreen = createKirokuChildrenScreen;
})();
