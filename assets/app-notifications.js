(() => {
  function createKirokuNotifications({ $, escapeHtml }) {
    let toastSequence = 0;
    const activeToastTimers = new Map();

    function showSuccess(message) {
      $("message").innerHTML = "";
      showToast("success", message, 4000);
    }

    function showError(error) {
      $("message").innerHTML = "";
      showToast("error", error.message || error, 7000);
    }

    function clearMessage() {
      $("message").innerHTML = "";
      clearToasts();
    }

    function showToast(type, message, duration) {
      const toastId = `toast-${++toastSequence}`;
      const toastLayer = $("toastLayer");
      const toneClass = type === "success" ? "success" : "error";
      const role = type === "success" ? "status" : "alert";
      const icon = type === "success"
        ? `<path d="M20 6L9 17l-5-5"></path>`
        : `<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line>`;
      const toast = document.createElement("div");
      toast.className = `toast toast-${type}`;
      toast.dataset.toastId = toastId;
      toast.setAttribute("role", role);
      toast.innerHTML = `<button type="button" class="toast-close" aria-label="Fermer la notification" onclick="dismissToast('${toastId}')"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button><p class="${toneClass}"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${icon}</svg>${escapeHtml(message)}</p>`;
      toastLayer.appendChild(toast);

      const timer = setTimeout(() => {
        dismissToast(toastId);
      }, duration);
      activeToastTimers.set(toastId, timer);
    }

    function dismissToast(toastId) {
      const toast = document.querySelector(`[data-toast-id="${toastId}"]`);
      if (!toast) {
        return;
      }

      const timer = activeToastTimers.get(toastId);
      if (timer) {
        clearTimeout(timer);
        activeToastTimers.delete(toastId);
      }

      toast.classList.add("toast-exit");
      setTimeout(() => {
        toast.remove();
      }, 180);
    }

    function clearToasts() {
      activeToastTimers.forEach((timer) => clearTimeout(timer));
      activeToastTimers.clear();
      $("toastLayer").innerHTML = "";
    }

    return {
      clearMessage,
      dismissToast,
      showError,
      showSuccess
    };
  }

  window.createKirokuNotifications = createKirokuNotifications;
})();
