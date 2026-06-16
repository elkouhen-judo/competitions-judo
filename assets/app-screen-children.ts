(() => {
  type KirokuApp = import("./types").KirokuApp;

  function createKirokuChildrenScreen(app: KirokuApp) {
    const { state, ui, notifications } = app;
    const { $, showView } = ui;
    const { clearMessage, showError, showSuccess } = notifications;
    const defaultChildForm = {
      judokaId: "",
      firstName: "",
      lastName: "",
      accountEmail: "",
      ageCategory: ""
    };
    const defaultChildrenViewState = {
      childFormTitle: "Ajouter un enfant",
      saveChildButtonText: "Ajouter l'enfant",
      childForm: { ...defaultChildForm }
    };
    let childrenViewModel: (typeof defaultChildrenViewState) | null = null;

    const children = window.Vue.computed(
      () =>
        window.KirokuScreenProjections.projectManagedChildren(state.managedChildren, {
          getJudokaDisplayName: ui.getJudokaDisplayName,
          normalizeDisplayName: ui.normalizeDisplayName,
          normalizeLastName: ui.normalizeLastName
        }).children
    );
    const hasChildren = window.Vue.computed(() => state.managedChildren.length > 0);

    function ensureChildrenViewModel() {
      if (childrenViewModel) {
        return;
      }

      childrenViewModel = ui.createMountedViewModel(
        "childrenView",
        defaultChildrenViewState,
        {
          deleteManagedChild,
          editManagedChild,
          resetChildForm,
          saveManagedChild,
          showHome: () => app.showHome && app.showHome()
        },
        { children, hasChildren }
      );
    }

    function getChildrenViewModel() {
      ensureChildrenViewModel();
      if (!childrenViewModel) {
        throw new Error("Vue model des enfants non initialisé.");
      }
      return childrenViewModel;
    }

    function showChildrenManagement(keepMessage?: boolean) {
      if (!keepMessage) {
        clearMessage();
      }

      app.runServer(
        "getChildrenManagement",
        [],
        (data) => {
          ensureChildrenViewModel();
          state.managedChildren = Array.isArray(data.children) ? data.children : [];
          resetChildForm();
          showView("childrenView");
        },
        showError
      );
    }

    function resetChildForm() {
      const viewModel = getChildrenViewModel();
      Object.assign(viewModel.childForm, defaultChildForm);
      viewModel.childFormTitle = "Ajouter un enfant";
      viewModel.saveChildButtonText = "Ajouter l'enfant";
    }

    function editManagedChild(idJudoka: string) {
      const child = state.managedChildren.find(
        (item) => String(item.judokaId) === String(idJudoka)
      );
      if (!child) {
        showError({ message: "Enfant introuvable." });
        return;
      }

      const viewModel = getChildrenViewModel();
      Object.assign(viewModel.childForm, {
        judokaId: child.judokaId || "",
        firstName: child.firstName || "",
        lastName: child.lastName || "",
        accountEmail: child.accountEmail || "",
        ageCategory: child.ageCategory || ""
      });
      viewModel.childFormTitle = "Modifier l'enfant";
      viewModel.saveChildButtonText = "Enregistrer l'enfant";
      showView("childrenView");
      window.Vue.nextTick(() => $("child_prenom").focus());
    }

    function saveManagedChild() {
      const viewModel = getChildrenViewModel();
      const child = {
        judokaId: viewModel.childForm.judokaId,
        firstName: viewModel.childForm.firstName,
        lastName: viewModel.childForm.lastName,
        accountEmail: viewModel.childForm.accountEmail,
        ageCategory: viewModel.childForm.ageCategory || ""
      };

      app.runServer(
        "saveManagedChild",
        [child],
        (response) => {
          showSuccess(response.message);
          app.reloadInitialDataAndShowChildren();
        },
        showError
      );
    }

    function deleteManagedChild(idJudoka: string, name?: string) {
      const label = name ? ` "${name}"` : "";
      app.confirmAndRun({
        message: `Supprimer l'enfant${label} ?`,
        method: "deleteManagedChild",
        args: [idJudoka],
        onSuccess: (response) => {
          showSuccess(response.message);
          app.reloadInitialDataAndShowChildren();
        }
      });
    }

    return {
      deleteManagedChild,
      editManagedChild,
      resetChildForm,
      saveManagedChild,
      showChildrenManagement
    };
  }

  window.createKirokuChildrenScreen = createKirokuChildrenScreen;
})();
