(() => {
  function createKirokuAdminsScreen(app) {
    const {
      defaultAccessInvitationVisibleCount,
      state,
      ui,
      notifications
    } = app;
    const {
      $,
      cleanText,
      emptyState,
      escapeAttribute,
      escapeHtml,
      formatDateTime,
      getJudokaDisplayName,
      getValue,
      icons,
      setValue,
      showView
    } = ui;
    const {
      clearMessage,
      showError,
      showSuccess
    } = notifications;

    function saveAccessInvitation() {
      const email = getValue("invite_email");
      const profileType = getValue("invite_profile_type");

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
      const target = $("accessInvitationsList");
      const summary = $("accessInvitationsSummary");
      if (!state.managedAccessInvitations.length) {
        summary.innerHTML = "";
        target.innerHTML = emptyState("Aucune invitation en attente.");
        return;
      }

      const filteredInvitations = getFilteredAccessInvitations();
      const hasActiveFilter = Boolean(state.accessInvitationSearch);
      const visibleInvitations = hasActiveFilter
        ? filteredInvitations
        : filteredInvitations.slice(0, state.accessInvitationVisibleCount);
      const remainingInvitations = Math.max(filteredInvitations.length - visibleInvitations.length, 0);
      const summaryLabel = hasActiveFilter
        ? `${filteredInvitations.length} résultat(s) sur ${state.managedAccessInvitations.length} invitation(s).`
        : `${visibleInvitations.length} invitation(s) affichée(s) sur ${state.managedAccessInvitations.length}.`;

      summary.innerHTML = `
        <div class="list-summary">
          <p class="list-summary-text">${escapeHtml(summaryLabel)}</p>
          <div class="list-summary-actions">
            ${hasActiveFilter
              ? `<button class="button-secondary" type="button" onclick="resetAccessInvitationSearch()">Effacer le filtre</button>`
              : remainingInvitations > 0
                ? `<button class="button-secondary" type="button" onclick="showMoreAccessInvitations()">Voir ${Math.min(defaultAccessInvitationVisibleCount, remainingInvitations)} de plus</button>
                   <button class="button-secondary" type="button" onclick="showAllAccessInvitations()">Tout afficher</button>`
                : state.accessInvitationVisibleCount > defaultAccessInvitationVisibleCount && filteredInvitations.length > defaultAccessInvitationVisibleCount
                  ? `<button class="button-secondary" type="button" onclick="collapseAccessInvitations()">Réduire la liste</button>`
                  : ""}
          </div>
        </div>
      `;

      if (!filteredInvitations.length) {
        target.innerHTML = `<div class="empty-state">Aucune invitation trouvée pour "${escapeHtml(state.accessInvitationSearch)}".</div>`;
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
      target.innerHTML = html;
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
      state.accessInvitationSearch = cleanText(value).toLowerCase();
      state.accessInvitationVisibleCount = defaultAccessInvitationVisibleCount;
      renderManagedAccessInvitations();
    }

    function resetAccessInvitationSearch() {
      state.accessInvitationSearch = "";
      state.accessInvitationVisibleCount = defaultAccessInvitationVisibleCount;
      const input = $("accessInvitationFilter");
      if (input) {
        input.value = "";
      }
      renderManagedAccessInvitations();
    }

    function showMoreAccessInvitations() {
      state.accessInvitationVisibleCount += defaultAccessInvitationVisibleCount;
      renderManagedAccessInvitations();
    }

    function showAllAccessInvitations() {
      state.accessInvitationVisibleCount = state.managedAccessInvitations.length;
      renderManagedAccessInvitations();
    }

    function collapseAccessInvitations() {
      state.accessInvitationVisibleCount = defaultAccessInvitationVisibleCount;
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
          state.managedAdmins = Array.isArray(data.admins) ? data.admins : [];
          state.managedAccessInvitations = Array.isArray(data.accessInvitations) ? data.accessInvitations : [];
          state.accessInvitationSearch = "";
          state.accessInvitationVisibleCount = defaultAccessInvitationVisibleCount;
          const invitationSearchInput = $("accessInvitationFilter");
          if (invitationSearchInput) {
            invitationSearchInput.value = "";
          }
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
      const target = $("adminsList");
      if (!state.managedAdmins.length) {
        target.innerHTML = emptyState("Aucun admin trouvé.");
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
      target.innerHTML = html;
    }

    function resetAdminForm() {
      setValue("admin_email", "");
    }

    function resetAccessInvitationForm() {
      setValue("invite_email", "");
      setValue("invite_profile_type", "JUDOKA");
    }

    function saveAdminRole() {
      const email = getValue("admin_email");

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
      collapseAccessInvitations,
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
      showAllAccessInvitations,
      showMoreAccessInvitations,
      updateAccessInvitationSearch
    };
  }

  window.createKirokuAdminsScreen = createKirokuAdminsScreen;
})();
