import { api } from "./api";

export async function verifyQrToken(token) {
  const res = await api.get("/qr/verify", { params: { token } });
  return res.data;
}
