import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { useAuth } from "./AuthContext.jsx";
import {
  listMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  markNotificationsRead,
} from "../services/notifications.service";

export type NotificationItem = {
  id: number;
  type?: string | null;
  message?: string | null;
  created_at?: string | null;
  read_at?: string | null;
  meta?: any;
};

type RealtimeContextValue = {
  connected: boolean;
  notifications: NotificationItem[];
  unreadCount: number;
  pendingValidationsCount: number;
  validationsTick: number;
  pendingPaiementsCount: number;
  pendingReceptionsCount: number;
  pendingAchatsCount: number;
  paiementsTick: number;
  receptionsTick: number;
  achatsTick: number;
  loadingNotifications: boolean;
  refreshNotifications: () => Promise<void>;
  markAsRead: (notif: NotificationItem) => Promise<void>;
  markManyAsRead: (ids: number[]) => Promise<void>;
  markAllAsRead: () => Promise<void>;
};

const RealtimeContext = createContext<RealtimeContextValue | null>(null);

function resolveSocketUrl() {
  const fallbackHost = typeof window !== "undefined" ? window.location.hostname : "localhost";
  const fallbackProtocol =
    typeof window !== "undefined" && window.location.protocol === "https:" ? "https" : "http";
  const fallbackPort = import.meta.env.VITE_API_PORT || "8000";
  const fallback = `${fallbackProtocol}://${fallbackHost}:${fallbackPort}`;

  const raw = import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL || "";
  if (!raw) return fallback;

  if (raw.startsWith("/")) return fallback;
  if (!/^https?:\/\//i.test(raw)) return fallback;

  try {
    const url = new URL(String(raw));
    if (url.pathname.endsWith("/api")) url.pathname = url.pathname.replace(/\/api$/, "");
    if (url.pathname.endsWith("/api/")) url.pathname = url.pathname.replace(/\/api\/$/, "/");
    return url.toString().replace(/\/+$/, "");
  } catch {
    return String(raw).replace(/\/api\/?$/, "");
  }
}

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const { auth, isAuthenticated } = useAuth();
  const token = auth?.accessToken || null;

  const [connected, setConnected] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [pendingValidationsCount, setPendingValidationsCount] = useState(0);
  const [validationsTick, setValidationsTick] = useState(0);
  const [pendingPaiementsCount, setPendingPaiementsCount] = useState(0);
  const [pendingReceptionsCount, setPendingReceptionsCount] = useState(0);
  const [pendingAchatsCount, setPendingAchatsCount] = useState(0);
  const [paiementsTick, setPaiementsTick] = useState(0);
  const [receptionsTick, setReceptionsTick] = useState(0);
  const [achatsTick, setAchatsTick] = useState(0);
  const [loadingNotifications, setLoadingNotifications] = useState(false);

  const socketRef = useRef<Socket | null>(null);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read_at).length,
    [notifications]
  );

  const refreshNotifications = useCallback(async () => {
    if (!token) {
      setNotifications([]);
      return;
    }
    setLoadingNotifications(true);
    try {
      const res = await listMyNotifications();
      if (res?.success) {
        setNotifications(Array.isArray(res.data) ? res.data : []);
      }
    } finally {
      setLoadingNotifications(false);
    }
  }, [token]);

  const markAsRead = useCallback(async (notif: NotificationItem) => {
    if (!notif?.id || notif.read_at) return;
    try {
      await markNotificationRead(notif.id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, read_at: new Date().toISOString() } : n))
      );
    } catch {
      // handled by api interceptor
    }
  }, []);

  const markManyAsRead = useCallback(async (ids: number[]) => {
    const uniqueIds = Array.from(
      new Set((Array.isArray(ids) ? ids : []).map((id) => Number(id)).filter((id) => Number.isInteger(id)))
    );
    if (!uniqueIds.length) return;
    try {
      await markNotificationsRead(uniqueIds);
      const readAt = new Date().toISOString();
      setNotifications((prev) =>
        prev.map((n) => (uniqueIds.includes(Number(n.id)) ? { ...n, read_at: n.read_at || readAt } : n))
      );
    } catch {
      // handled by api interceptor
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    try {
      await markAllNotificationsRead();
      const readAt = new Date().toISOString();
      setNotifications((prev) => prev.map((n) => ({ ...n, read_at: n.read_at || readAt })));
    } catch {
      // handled by api interceptor
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !token) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setConnected(false);
      setNotifications([]);
      setPendingValidationsCount(0);
      setValidationsTick(0);
      setPendingPaiementsCount(0);
      setPendingReceptionsCount(0);
      setPendingAchatsCount(0);
      setPaiementsTick(0);
      setReceptionsTick(0);
      setAchatsTick(0);
      return;
    }

    // Initial refresh even if socket fails to connect.
    refreshNotifications();

    const socket = io(resolveSocketUrl(), {
      auth: { token },
      transports: ["websocket", "polling"],
    });
    socketRef.current = socket;

    const handleConnect = () => {
      setConnected(true);
      refreshNotifications();
    };

    const handleDisconnect = () => {
      setConnected(false);
    };

    const handleNotificationNew = (payload: { notification?: NotificationItem }) => {
      const notif = payload?.notification;
      if (!notif?.id) return;
      const type = String(notif.type || "").toLowerCase();
      if (
        [
          "paiement_pending",
          "paiement_effectue",
          "paiement_updated",
          "paiement_deleted",
        ].includes(type)
      ) {
        setPaiementsTick((t) => t + 1);
      }
      if (
        [
          "validation_pending",
          "validation_step_approved",
          "validation_rejected",
          "validation_returned",
          "validation_cancelled",
        ].includes(type)
      ) {
        setValidationsTick((t) => t + 1);
      }
      if (
        [
          "reception_creee",
          "reception_updated",
          "reception_deleted",
          "reception_visa_pending",
          "reception_visa_directeur",
          "reception_visa_daf",
        ].includes(type)
      ) {
        setReceptionsTick((t) => t + 1);
      }
      if (["demande_acheteur_assigne", "demande_acheteur_retire", "achat_effectue"].includes(type)) {
        setAchatsTick((t) => t + 1);
      }
      setNotifications((prev) => {
        if (prev.some((n) => n.id === notif.id)) return prev;
        if (type === "validation_pending" && !notif.read_at) {
          setPendingValidationsCount((c) => c + 1);
        }
        return [notif, ...prev];
      });
    };

    const handleNotificationRead = (payload: { id?: number; read_at?: string }) => {
      const id = payload?.id;
      if (!id) return;
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read_at: payload.read_at || new Date().toISOString() } : n))
      );
    };

    const handlePendingStatus = (payload: { count?: number; hasPending?: boolean }) => {
      if (typeof payload?.count === "number") {
        setPendingValidationsCount(payload.count);
        setValidationsTick((t) => t + 1);
        return;
      }
      if (typeof payload?.hasPending === "boolean") {
        setPendingValidationsCount(payload.hasPending ? 1 : 0);
        setValidationsTick((t) => t + 1);
      }
    };

    const handlePaiementPendingStatus = (payload: { count?: number; hasPending?: boolean }) => {
      if (typeof payload?.count === "number") {
        setPendingPaiementsCount(payload.count);
        return;
      }
      if (typeof payload?.hasPending === "boolean") {
        setPendingPaiementsCount(payload.hasPending ? 1 : 0);
      }
    };

    const handleReceptionPendingStatus = (payload: { count?: number; hasPending?: boolean }) => {
      if (typeof payload?.count === "number") {
        setPendingReceptionsCount(payload.count);
        setReceptionsTick((t) => t + 1);
        return;
      }
      if (typeof payload?.hasPending === "boolean") {
        setPendingReceptionsCount(payload.hasPending ? 1 : 0);
        setReceptionsTick((t) => t + 1);
      }
    };

    const handleAchatPendingStatus = (payload: { count?: number; hasPending?: boolean }) => {
      if (typeof payload?.count === "number") {
        setPendingAchatsCount(payload.count);
        return;
      }
      if (typeof payload?.hasPending === "boolean") {
        setPendingAchatsCount(payload.hasPending ? 1 : 0);
      }
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("notification:new", handleNotificationNew);
    socket.on("notification:read", handleNotificationRead);
    socket.on("validation:pending_status", handlePendingStatus);
    socket.on("paiement:pending_status", handlePaiementPendingStatus);
    socket.on("reception:pending_status", handleReceptionPendingStatus);
    socket.on("achat:pending_status", handleAchatPendingStatus);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("notification:new", handleNotificationNew);
      socket.off("notification:read", handleNotificationRead);
      socket.off("validation:pending_status", handlePendingStatus);
      socket.off("paiement:pending_status", handlePaiementPendingStatus);
      socket.off("reception:pending_status", handleReceptionPendingStatus);
      socket.off("achat:pending_status", handleAchatPendingStatus);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [isAuthenticated, token, refreshNotifications]);

  const value = useMemo(
    () => ({
      connected,
      notifications,
      unreadCount,
      pendingValidationsCount,
      validationsTick,
      pendingPaiementsCount,
      pendingReceptionsCount,
      pendingAchatsCount,
      paiementsTick,
      receptionsTick,
      achatsTick,
      loadingNotifications,
      refreshNotifications,
      markAsRead,
      markManyAsRead,
      markAllAsRead,
    }),
    [
      connected,
      notifications,
      unreadCount,
      pendingValidationsCount,
      validationsTick,
      pendingPaiementsCount,
      pendingReceptionsCount,
      pendingAchatsCount,
      paiementsTick,
      receptionsTick,
      achatsTick,
      loadingNotifications,
      refreshNotifications,
      markAsRead,
      markManyAsRead,
      markAllAsRead,
    ]
  );

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

export function useRealtime() {
  const ctx = useContext(RealtimeContext);
  if (!ctx) throw new Error("useRealtime must be used within RealtimeProvider");
  return ctx;
}
