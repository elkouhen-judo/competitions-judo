(() => {
  function createKirokuChildrenScreen(app) {
    const { state, ui, notifications } = app;
    const {
      $,
      getJudokaDisplayName,
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
      children: [],
      hasChildren: false,
      childFormTitle: "Ajouter un enfant",
      saveChildButtonText: "Ajouter l'enfant",
      childForm: { ...defaultChildForm }
    };
    let childrenViewModel = null;

    function ensureChildrenViewModel() {
      if (!window.Vue || childrenViewModel) {
        return;
      }

      childrenViewModel = ui.createMountedViewModel("childrenView", defaultChildrenViewState, {
        deleteManagedChild,
        editManagedChild,
        resetChildForm,
        saveManagedChild,
        showHome: () => app.showHome()
      });
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
      childrenViewModel.children = state.managedChildren.map(child => {
        const fullName = getJudokaDisplayName(child) || "Enfant";
        return {
          judokaId: child.judokaId || "",
          fullName,
          firstName: normalizeDisplayName(child.firstName || ""),
          lastName: normalizeLastName(child.lastName || ""),
          accountEmail: child.accountEmail || "Non renseigné",
          directAccessState: child.accountEmail ? "Activée" : "Non activée"
        };
      });
      childrenViewModel.hasChildren = childrenViewModel.children.length > 0;
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
