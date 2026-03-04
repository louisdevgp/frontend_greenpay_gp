import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FiCheckCircle, FiInfo, FiAlertTriangle, FiXCircle, FiX } from "react-icons/fi";
import { TOAST_EVENT } from "../../services/toastBus";

const DEFAULT_TIMEOUTS = {
  success: 4500,
  info: 4500,
  warning: 6000,
  error: 6000,
};

const VARIANT_STYLES = {
  success: {
    container: "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-100",
    icon: <FiCheckCircle />,
  },
  info: {
    container: "border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900/40 dark:bg-blue-900/20 dark:text-blue-100",
    icon: <FiInfo />,
  },
  warning: {
    container: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-100",
    icon: <FiAlertTriangle />,
  },
  error: {
    container: "border-red-200 bg-red-50 text-red-900 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-100",
    icon: <FiXCircle />,
  },
};

function normalizePayload(payload) {
  const variant = payload?.variant || "info";
  const title = payload?.title || "";
  const message = payload?.message || "";
  const timeoutMs =
    typeof payload?.timeoutMs === "number" ? payload.timeoutMs : DEFAULT_TIMEOUTS[variant] ?? 4500;

  return { variant, title, message, timeoutMs };
}

export default function ToastHost() {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef(new Map());

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const scheduleDismiss = useCallback(
    (id, timeoutMs) => {
      if (!timeoutMs || timeoutMs <= 0) return;
      const timer = setTimeout(() => removeToast(id), timeoutMs);
      timersRef.current.set(id, timer);
    },
    [removeToast]
  );

  useEffect(() => {
    const handler = (event) => {
      const payload = normalizePayload(event?.detail || {});
      if (!payload.message) return;

      const id = `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      const toast = { id, ...payload };
      setToasts((prev) => [...prev, toast]);
      scheduleDismiss(id, payload.timeoutMs);
    };

    window.addEventListener(TOAST_EVENT, handler);
    return () => window.removeEventListener(TOAST_EVENT, handler);
  }, [scheduleDismiss]);

  const rendered = useMemo(
    () =>
      toasts.map((toast) => {
        const style = VARIANT_STYLES[toast.variant] || VARIANT_STYLES.info;
        return (
          <div
            key={toast.id}
            className={`pointer-events-auto w-full max-w-sm rounded-xl border px-4 py-3 shadow-lg ${style.container}`}
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 text-lg">{style.icon}</div>
              <div className="flex-1">
                {toast.title ? (
                  <div className="text-sm font-semibold leading-5">{toast.title}</div>
                ) : null}
                <div className="text-sm text-gray-700 dark:text-gray-200">{toast.message}</div>
              </div>
              <button
                type="button"
                onClick={() => removeToast(toast.id)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-300 dark:hover:text-white"
                aria-label="Fermer"
                title="Fermer"
              >
                <FiX />
              </button>
            </div>
          </div>
        );
      }),
    [toasts, removeToast]
  );

  if (!toasts.length) return null;

  return (
    <div className="pointer-events-none fixed left-1/2 top-6 z-[100000] flex w-full max-w-md -translate-x-1/2 flex-col gap-3 px-4">
      {rendered}
    </div>
  );
}
