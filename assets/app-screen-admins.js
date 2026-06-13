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
      emptyState,
      escapeAttribute,
      escapeHtml,
      formatDateTime,
      getJudokaDisplayName,
      icons,
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
      accessInvitationsSummaryHtml: "",
      accessInvitationsListHtml: "",
      adminsListHtml: "",
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
            resetAccessInvitationForm,
            resetAdminForm,
            saveAccessInvitation,
            saveAdminRole,
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
        adminsViewModel.accessInvitationsSummaryHtml = "";
        adminsViewModel.accessInvitationsListHtml = emptyState("Aucune invitation en attente.");
        return;
      }
      const filteredInvitations = getFilteredAccessInvitations();
      const pageSize = defaultAccessInvitationVisibleCount;
      const totalPages = Math.max(Math.ceil(filteredInvitations.length / pageSize), 1);
      const currentPage = Math.min(state.accessInvitationCurrentPage, totalPages);
      const startIndex = (currentPage - 1) * pageSize;
      const visibleInvitations = filteredInvitations.slice(startIndex, startIndex + pageSize);
      const summaryLabel = `${filteredInvitations.length} invitation(s)${state.accessInvitationSearch ? " trouvée(s)" : ""} · page ${currentPage} / ${totalPages}.`;

      adminsViewModel.accessInvitationsSummaryHtml = `
        <div class="list-summary">
          <p class="list-summary-text">${escapeHtml(summaryLabel)}</p>
          <div class="list-summary-actions">
            ${state.accessInvitationSearch
              ? `<button class="button-secondary" type="button" onclick="resetAccessInvitationSearch()">Effacer le filtre</button>`
              : ""}
            ${currentPage > 1
              ? `<button class="button-secondary" type="button" onclick="showPreviousAccessInvitationPage()">Page précédente</button>`
              : ""}
            ${currentPage < totalPages
              ? `<button class="button-secondary" type="button" onclick="showNextAccessInvitationPage()">Page suivante</button>`
              : ""}
          </div>
        </div>
      `;

      if (!filteredInvitations.length) {
        adminsViewModel.accessInvitationsListHtml = `<div class="empty-state">Aucune invitation trouvée pour "${escapeHtml(state.accessInvitationSearch)}".</div>`;
        return;
      }

      let html = `<div class="list">`;
      visibleInvitations.forEach(invitation => {
        html += `
          <article class="card admin-card">
            <p class="card-title">${escapeHtml(invitation.email || "Invitation")}</p>
            <div class="card-meta">
              <div class="meta-row">
                <span class="meta-label">Profil</span>
                <span class="meta-value">${escapeHtml(invitation.invitedProfileType || "JUDOKA")}</span>
              </div>
              <div class="meta-row">
                <span class="meta-label">Créée le</span>
                <span class="meta-value">${escapeHtml(formatDateTime(invitation.createdAt))}</span>
              </div>
            </div>
            <div class="card-actions">
              <button class="button-danger" type="button" data-email="${escapeAttribute(invitation.email)}" onclick="deleteAccessInvitation(this.dataset.email)">
                ${icons.trash}
                Retirer l'invitation
              </button>
            </div>
          </article>
        `;
      });
      html += `</div>`;
      adminsViewModel.accessInvitationsListHtml = html;
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
      if (!state.managedAdmins.length) {
        adminsViewModel.adminsListHtml = emptyState("Aucun admin trouvé.");
        return;
      }

      let html = `<div class="list">`;
      state.managedAdmins.forEach(admin => {
        const fullName = getJudokaDisplayName(admin) || admin.accountEmail || "Admin";
        const isCurrentAdmin = state.currentUser && String(state.currentUser.judokaId) === String(admin.judokaId);
        html += `
          <article class="card admin-card">
            <p class="card-title">${escapeHtml(fullName)}</p>
            <div class="card-meta">
              <div class="meta-row">
                <span class="meta-label">Email</span>
                <span class="meta-value">${escapeHtml(admin.accountEmail || "Non renseigné")}</span>
              </div>
            </div>
            <div class="card-actions">
              ${isCurrentAdmin
                ? `<span class="current-admin-note">Vous</span>`
                : `<button class="button-danger" type="button" data-id="${escapeAttribute(admin.judokaId)}" data-name="${escapeAttribute(fullName)}" onclick="revokeAdminRole(this.dataset.id, this.dataset.name)">${icons.shieldOff}Révoquer</button>`}
            </div>
          </article>
        `;
      });
      html += `</div>`;
      adminsViewModel.adminsListHtml = html;
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
