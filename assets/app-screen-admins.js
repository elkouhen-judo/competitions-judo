(() => {
  function createKirokuAdminsScreen(app) {
    const {
      defaultAccessInvitationVisibleCount,
      state,
      ui,
      notifications
    } = app;
    const {
      cleanText,
      formatDateTime,
      getJudokaDisplayName,
      showView
    } = ui;
    const {
      clearMessage,
      showError,
      showSuccess
    } = notifications;
    const defaultAccessInvitationForm = {
      email: "",
      profileType: "JUDOKA"
    };
    const defaultAdminsViewState = {
      accessInvitationForm: { ...defaultAccessInvitationForm },
      accessInvitationSearch: "",
      accessInvitations: [],
      accessInvitationsSummary: "",
      accessInvitationsEmptyMessage: "Aucune invitation en attente.",
      canResetAccessInvitationSearch: false,
      canShowPreviousAccessInvitationPage: false,
      canShowNextAccessInvitationPage: false,
      hasAccessInvitations: false,
      admins: [],
      hasAdmins: false,
      adminEmail: ""
    };
    let adminsViewModel = null;

    function ensureAdminsViewModel() {
      if (!window.Vue || adminsViewModel) {
        return;
      }

      adminsViewModel = window.Vue.reactive({
        ...defaultAdminsViewState,
        accessInvitationForm: { ...defaultAccessInvitationForm }
      });

      window.Vue.createApp({
        setup() {
          return {
            ...window.Vue.toRefs(adminsViewModel),
            deleteAccessInvitation,
            resetAccessInvitationSearch,
            resetAccessInvitationForm,
            resetAdminForm,
            revokeAdminRole,
            saveAccessInvitation,
            saveAdminRole,
            showNextAccessInvitationPage,
            showPreviousAccessInvitationPage,
            showHome: () => app.showHome(),
            updateAccessInvitationSearch
          };
        }
      }).mount("#adminsView");
    }

    function saveAccessInvitation() {
      ensureAdminsViewModel();
      const email = adminsViewModel.accessInvitationForm.email;
      const profileType = adminsViewModel.accessInvitationForm.profileType;

      app.runServer(
        "saveAccessInvitation",
        [email, profileType],
        response => {
          showSuccess(response.message);
          app.reloadInitialDataAndShowAdmins();
        },
        showError
      );
    }

    function deleteAccessInvitation(email) {
      const label = email ? ` pour "${email}"` : "";
      app.confirmAndRun({
        message: `Supprimer l'invitation${label} ?`,
        method: "deleteAccessInvitation",
        args: [email],
        onSuccess: response => {
          showSuccess(response.message);
          app.reloadInitialDataAndShowAdmins();
        }
      });
    }

    function renderManagedAccessInvitations() {
      ensureAdminsViewModel();
      if (!state.managedAccessInvitations.length) {
        Object.assign(adminsViewModel, {
          accessInvitations: [],
          accessInvitationsSummary: "",
          accessInvitationsEmptyMessage: "Aucune invitation en attente.",
          canResetAccessInvitationSearch: false,
          canShowPreviousAccessInvitationPage: false,
          canShowNextAccessInvitationPage: false,
          hasAccessInvitations: false
        });
        return;
      }
      const filteredInvitations = getFilteredAccessInvitations();
      const pageSize = defaultAccessInvitationVisibleCount;
      const totalPages = Math.max(Math.ceil(filteredInvitations.length / pageSize), 1);
      const currentPage = Math.min(state.accessInvitationCurrentPage, totalPages);
      const startIndex = (currentPage - 1) * pageSize;
      const visibleInvitations = filteredInvitations.slice(startIndex, startIndex + pageSize);
      const summaryLabel = `${filteredInvitations.length} invitation(s)${state.accessInvitationSearch ? " trouvée(s)" : ""} · page ${currentPage} / ${totalPages}.`;

      Object.assign(adminsViewModel, {
        accessInvitations: visibleInvitations.map(invitation => ({
          email: invitation.email || "Invitation",
          invitedProfileType: invitation.invitedProfileType || "JUDOKA",
          createdAt: formatDateTime(invitation.createdAt)
        })),
        accessInvitationsSummary: summaryLabel,
        accessInvitationsEmptyMessage: state.accessInvitationSearch
          ? `Aucune invitation trouvée pour "${state.accessInvitationSearch}".`
          : "Aucune invitation en attente.",
        canResetAccessInvitationSearch: Boolean(state.accessInvitationSearch),
        canShowPreviousAccessInvitationPage: currentPage > 1,
        canShowNextAccessInvitationPage: currentPage < totalPages,
        hasAccessInvitations: Boolean(filteredInvitations.length)
      });
    }

    function getFilteredAccessInvitations() {
      if (!state.accessInvitationSearch) {
        return state.managedAccessInvitations;
      }

      return state.managedAccessInvitations.filter(invitation =>
        cleanText(invitation.email).toLowerCase().includes(state.accessInvitationSearch)
      );
    }

    function updateAccessInvitationSearch(value) {
      ensureAdminsViewModel();
      state.accessInvitationSearch = cleanText(value).toLowerCase();
      adminsViewModel.accessInvitationSearch = value || "";
      state.accessInvitationCurrentPage = 1;
      renderManagedAccessInvitations();
    }

    function resetAccessInvitationSearch() {
      ensureAdminsViewModel();
      state.accessInvitationSearch = "";
      adminsViewModel.accessInvitationSearch = "";
      state.accessInvitationCurrentPage = 1;
      renderManagedAccessInvitations();
    }

    function showNextAccessInvitationPage() {
      state.accessInvitationCurrentPage += 1;
      renderManagedAccessInvitations();
    }

    function showPreviousAccessInvitationPage() {
      state.accessInvitationCurrentPage = Math.max(state.accessInvitationCurrentPage - 1, 1);
      renderManagedAccessInvitations();
    }

    function showAdminsManagement(keepMessage) {
      if (!keepMessage) {
        clearMessage();
      }

      app.runServer(
        "getAdminsManagement",
        [],
        data => {
          ensureAdminsViewModel();
          state.managedAdmins = Array.isArray(data.admins) ? data.admins : [];
          state.managedAccessInvitations = Array.isArray(data.accessInvitations) ? data.accessInvitations : [];
          state.accessInvitationSearch = "";
          state.accessInvitationCurrentPage = 1;
          adminsViewModel.accessInvitationSearch = "";
          renderManagedAdmins();
          renderManagedAccessInvitations();
          resetAccessInvitationForm();
          resetAdminForm();
          showView("adminsView");
        },
        showError
      );
    }

    function renderManagedAdmins() {
      ensureAdminsViewModel();
      adminsViewModel.admins = state.managedAdmins.map(admin => {
        const fullName = getJudokaDisplayName(admin) || admin.accountEmail || "Admin";
        const isCurrentAdmin = state.currentUser && String(state.currentUser.judokaId) === String(admin.judokaId);
        return {
          judokaId: admin.judokaId || "",
          fullName,
          accountEmail: admin.accountEmail || "Non renseigné",
          isCurrentAdmin
        };
      });
      adminsViewModel.hasAdmins = adminsViewModel.admins.length > 0;
    }

    function resetAdminForm() {
      ensureAdminsViewModel();
      adminsViewModel.adminEmail = "";
    }

    function resetAccessInvitationForm() {
      ensureAdminsViewModel();
      Object.assign(adminsViewModel.accessInvitationForm, defaultAccessInvitationForm);
    }

    function saveAdminRole() {
      ensureAdminsViewModel();
      const email = adminsViewModel.adminEmail;

      app.runServer(
        "grantAdminRole",
        [email],
        response => {
          showSuccess(response.message);
          app.reloadInitialDataAndShowAdmins();
        },
        showError
      );
    }

    function revokeAdminRole(idJudoka, name) {
      const label = name ? ` "${name}"` : "";
      app.confirmAndRun({
        message: `Retirer les droits admin${label} ?`,
        method: "revokeAdminRole",
        args: [idJudoka],
        onSuccess: response => {
          showSuccess(response.message);
          app.reloadInitialDataAndShowAdmins();
        }
      });
    }

    return {
      deleteAccessInvitation,
      renderManagedAccessInvitations,
      renderManagedAdmins,
      resetAccessInvitationForm,
      resetAccessInvitationSearch,
      resetAdminForm,
      revokeAdminRole,
      saveAccessInvitation,
      saveAdminRole,
      showAdminsManagement,
      showNextAccessInvitationPage,
      showPreviousAccessInvitationPage,
      updateAccessInvitationSearch
    };
  }

  window.createKirokuAdminsScreen = createKirokuAdminsScreen;
})();
