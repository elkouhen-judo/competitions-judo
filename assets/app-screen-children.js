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
      showView
    } = ui;
    const {
      clearMessage,
      showError,
      showSuccess
    } = notifications;
    const defaultChildForm = {
      judokaId: "",
      firstName: "",
      lastName: "",
      accountEmail: ""
    };
    const defaultChildrenViewState = {
      childrenListHtml: "",
      childFormTitle: "Ajouter un enfant",
      saveChildButtonText: "Ajouter l'enfant",
      childForm: { ...defaultChildForm }
    };
    let childrenViewModel = null;

    function ensureChildrenViewModel() {
      if (!window.Vue || childrenViewModel) {
        return;
      }

      childrenViewModel = window.Vue.reactive({
        ...defaultChildrenViewState,
        childForm: { ...defaultChildForm }
      });

      window.Vue.createApp({
        setup() {
          return {
            ...window.Vue.toRefs(childrenViewModel),
            resetChildForm,
            saveManagedChild,
            showHome: () => app.showHome()
          };
        }
      }).mount("#childrenView");
    }

    function showChildrenManagement(keepMessage) {
      if (!keepMessage) {
        clearMessage();
      }

      app.runServer(
        "getChildrenManagement",
        [],
        data => {
          ensureChildrenViewModel();
          state.managedChildren = Array.isArray(data.children) ? data.children : [];
          renderManagedChildren();
          resetChildForm();
          showView("childrenView");
        },
        showError
      );
    }

    function renderManagedChildren() {
      ensureChildrenViewModel();
      if (!state.managedChildren.length) {
        childrenViewModel.childrenListHtml = emptyState("Aucun enfant enregistré pour le moment.");
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
      childrenViewModel.childrenListHtml = html;
    }

    function resetChildForm() {
      ensureChildrenViewModel();
      Object.assign(childrenViewModel.childForm, defaultChildForm);
      childrenViewModel.childFormTitle = "Ajouter un enfant";
      childrenViewModel.saveChildButtonText = "Ajouter l'enfant";
    }

    function editManagedChild(idJudoka) {
      const child = state.managedChildren.find(item => String(item.judokaId) === String(idJudoka));
      if (!child) {
        showError({ message: "Enfant introuvable." });
        return;
      }

      ensureChildrenViewModel();
      Object.assign(childrenViewModel.childForm, {
        judokaId: child.judokaId || "",
        firstName: child.firstName || "",
        lastName: child.lastName || "",
        accountEmail: child.accountEmail || ""
      });
      childrenViewModel.childFormTitle = "Modifier l'enfant";
      childrenViewModel.saveChildButtonText = "Enregistrer l'enfant";
      showView("childrenView");
      window.Vue.nextTick(() => $("child_prenom").focus());
    }

    function saveManagedChild() {
      ensureChildrenViewModel();
      const child = {
        judokaId: childrenViewModel.childForm.judokaId,
        firstName: childrenViewModel.childForm.firstName,
        lastName: childrenViewModel.childForm.lastName,
        accountEmail: childrenViewModel.childForm.accountEmail
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
