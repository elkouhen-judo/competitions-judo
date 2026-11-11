(() => {
  type NotificationsApi = import("./types").NotificationsApi;

  interface Toast {
    id: string;
    type: "success" | "error";
    message: string;
    toneClass: "success" | "error";
    role: "status" | "alert";
    leaving: boolean;
  }

  // UI-6 : une erreur technique du navigateur (réponse vide, propriété absente) ne s'affiche
  // jamais telle quelle.
  const TECHNICAL_ERROR_PATTERN = /cannot read propert|undefined is not|is not a function|is not an object|unexpected token|failed to fetch/i;

  function toReadableMessage(message: string): string {
    if (!message.trim()) return "L'opération a échoué. Réessayez.";
    return TECHNICAL_ERROR_PATTERN.test(message) ? "L'opération a échoué. Réessayez." : message;
  }

  function getErrorMessage(error: unknown): string {
    if (typeof error === "string") {
      return toReadableMessage(error);
    }

    if (error && typeof error === "object" && "message" in error) {
      return toReadableMessage(String((error as { message?: unknown }).message || ""));
    }

    return toReadableMessage(String(error || ""));
  }

  function createKirokuNotifications(): NotificationsApi {
    let toastSequence = 0;
    const activeToastTimers = new Map<string, number>();
    const notificationsViewModel: { toasts: Toast[] } = window.Vue.reactive({
      toasts: []
    });

    window.KirokuUI.mountViewModel("toastLayer", notificationsViewModel, {
      dismissToast
    });

    function showSuccess(message: string) {
      showToast("success", message, 4000);
    }

    function showError(error: unknown) {
      showToast("error", getErrorMessage(error), 7000);
    }

    function clearMessage() {
      clearToasts();
    }

    function showToast(type: "success" | "error", message: unknown, duration: number) {
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

      const timer = window.setTimeout(() => {
        dismissToast(toastId);
      }, duration);
      activeToastTimers.set(toastId, timer);
    }

    function dismissToast(toastId: string) {
      const toast = notificationsViewModel.toasts.find((item) => item.id === toastId);
      if (!toast) {
        return;
      }

      const timer = activeToastTimers.get(toastId);
      if (timer) {
        window.clearTimeout(timer);
        activeToastTimers.delete(toastId);
      }

      toast.leaving = true;
      window.setTimeout(() => {
        notificationsViewModel.toasts = notificationsViewModel.toasts.filter(
          (item) => item.id !== toastId
        );
      }, 180);
    }

    function clearToasts() {
      activeToastTimers.forEach((timer) => window.clearTimeout(timer));
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
