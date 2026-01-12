import { toast } from "react-toastify";

export type ToastVariant = "success" | "error" | "warning" | "info";

export type ToastEventPayload = {
  variant: ToastVariant;
  title?: string;
  message: string;
  timeoutMs?: number;
};

export function emitToast(payload: ToastEventPayload) {
  const title = payload.title ? `${payload.title} — ` : "";
  const content = `${title}${payload.message}`;

  toast(content, {
    type: payload.variant,
    autoClose: typeof payload.timeoutMs === "number" ? payload.timeoutMs : 4500,
  });
}
