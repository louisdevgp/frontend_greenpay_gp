import { api } from "./api";

export async function listFirmaWebhookEvents() {
  const res = await api.get("/webhooks/firma/events");
  return res.data;
}
