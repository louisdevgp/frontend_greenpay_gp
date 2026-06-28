import { api } from "./api";

export async function listMyNotifications({ unreadOnly = false } = {}) {
  const res = await api.get("/notifications/my", {
    params: unreadOnly ? { unreadOnly: 1 } : {},
  });
  return res.data; // { success, message, data }
}

export async function markNotificationRead(id) {
  const res = await api.patch(`/notifications/${id}/read`);
  return res.data;
}

export async function markNotificationsRead(ids) {
  const res = await api.patch("/notifications/read-many", { ids });
  return res.data;
}

export async function markAllNotificationsRead() {
  const res = await api.patch("/notifications/read-all");
  return res.data;
}
