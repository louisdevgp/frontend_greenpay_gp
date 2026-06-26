import { api } from "./api";

export async function requestOtp() {
  const res = await api.post("/auth/otp/request");
  return res.data;
}

export async function verifyOtp(code) {
  const res = await api.post("/auth/otp/verify", { code });
  return res.data;
}
