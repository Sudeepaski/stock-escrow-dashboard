import axios from "axios";

// BASE URL (Render backend)
export const API_BASE =
  import.meta.env.VITE_API_BASE ||
  "https://stock-escrow-dashboard-backend.onrender.com";

// Axios instance with defaults
const api = axios.create({
  baseURL: API_BASE,
  timeout: 10000,
});

// ---------- AUTH ----------

export async function apiRegister(payload) {
  const r = await api.post("/auth/register", payload);
  return r.data;
}

export async function apiLogin(email, password) {
  const r = await api.post("/auth/login", { email, password });
  return r.data;
}

export async function apiGetMe(token) {
  const r = await api.get("/me", {
    headers: { Authorization: `Bearer ${token}` },
  });
  return r.data;
}

// ---------- WALLET ----------

export async function apiDeposit(token, amount) {
  const r = await api.post(
    "/wallet/deposit",
    { amount },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return r.data;
}

export async function apiWithdraw(token, amount) {
  const r = await api.post(
    "/wallet/withdraw",
    { amount },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return r.data;
}

// ---------- TRADING (BUY/SELL) ----------

export async function apiSubscribe(token, ticker, units = 1) {
  const r = await api.post(
    "/subscribe",
    { ticker, units },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return r.data;
}

export async function apiUnsubscribe(token, positionId) {
  const r = await api.post(
    "/unsubscribe",
    { positionId },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return r.data;
}

// ---------- PROFILE / HISTORY ----------

export async function apiHistory(token) {
  const r = await api.get("/profile/history", {
    headers: { Authorization: `Bearer ${token}` },
  });
  return r.data;
}

export async function apiProfileUpdate(token, payload) {
  const r = await api.post("/profile/update", payload, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return r.data;
}

export async function apiChangePassword(token, oldPassword, newPassword) {
  const r = await api.post(
    "/profile/change-password",
    { oldPassword, newPassword },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return r.data;
}
