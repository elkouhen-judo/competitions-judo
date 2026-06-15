(() => {
  function createKirokuNotifications() {
    let toastSequence = 0;
    const activeToastTimers = new Map();
    const notificationsViewModel = window.Vue.reactive({
      toasts: []
    });

    window.KirokuUI.mountViewModel("toastLayer", notificationsViewModel, {
      dismissToast
    });

    function showSuccess(message) {
      showToast("success", message, 4000);
    }

    function showError(error) {
      showToast("error", error.message || error, 7000);
    }

    function clearMessage() {
      clearToasts();
    }

    function showToast(type, message, duration) {
      const toastId = `toast-${++toastSequence}`;
      const toneClass = type === "success" ? "success" : "error";
      const role = type === "success" ? "status" : "alert";
      notificationsViewModel.toasts.push({
        id: toastId,
        type,
        message: String(message || ""),
        toneClass,
        role,
        leaving: false
      });

      const timer = setTimeout(() => {
        dismissToast(toastId);
      }, duration);
      activeToastTimers.set(toastId, timer);
    }

    function dismissToast(toastId) {
      const toast = notificationsViewModel.toasts.find((item) => item.id === toastId);
      if (!toast) {
        return;
      }

      const timer = activeToastTimers.get(toastId);
      if (timer) {
        clearTimeout(timer);
        activeToastTimers.delete(toastId);
      }

      toast.leaving = true;
      setTimeout(() => {
        notificationsViewModel.toasts = notificationsViewModel.toasts.filter(
          (item) => item.id !== toastId
        );
      }, 180);
    }

    function clearToasts() {
      activeToastTimers.forEach((timer) => clearTimeout(timer));
      activeToastTimers.clear();
      notificationsViewModel.toasts = [];
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
