import Swal from "sweetalert2";

export type ToastVariant = "success" | "error" | "warning" | "info";

export type ToastEventPayload = {
  variant: ToastVariant;
  title?: string;
  message: string;
  timeoutMs?: number;
};

export function emitToast(payload: ToastEventPayload) {
  const iconMap: Record<ToastVariant, "success" | "error" | "warning" | "info"> = {
    success: "success",
    error: "error",
    warning: "warning",
    info: "info",
  };

  const icon = iconMap[payload.variant] || "info";
  const timer = typeof payload.timeoutMs === "number" ? payload.timeoutMs : 4500;
  const isBlocking = payload.variant === "error" || payload.variant === "warning";

  Swal.fire({
    icon,
    title: payload.title || undefined,
    text: payload.message,
    position: "top-end", // Meilleure visibilité
    timer: isBlocking ? undefined : timer,
    timerProgressBar: !isBlocking,
    showConfirmButton: isBlocking,
    confirmButtonText: "OK",
    customClass: {
      popup: "z-[9999]", // Z-index élevé pour être au-dessus des modales
    },
  });
}
