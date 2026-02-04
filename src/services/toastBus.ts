export type ToastVariant = "success" | "error" | "warning" | "info";

export type ToastEventPayload = {
  variant: ToastVariant;
  title?: string;
  message: string;
  timeoutMs?: number;
};

export const TOAST_EVENT = "gp-toast";

type LegacyArgs = [string, ToastVariant?];

function normalizePayload(
  payloadOrMessage: ToastEventPayload | string,
  legacyVariant?: ToastVariant
): ToastEventPayload {
  if (typeof payloadOrMessage === "string") {
    return {
      variant: legacyVariant || "info",
      message: payloadOrMessage,
    };
  }
  return payloadOrMessage;
}

export function emitToast(payload: ToastEventPayload): void;
export function emitToast(message: string, variant?: ToastVariant): void;
export function emitToast(payloadOrMessage: ToastEventPayload | string, ...rest: LegacyArgs) {
  const payload = normalizePayload(payloadOrMessage, rest[0]);
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(TOAST_EVENT, { detail: payload }));
}
