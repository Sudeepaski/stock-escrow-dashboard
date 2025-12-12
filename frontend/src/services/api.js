import axios from "axios";
const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

export async function apiRegister(payload) {
  const r = await axios.post(`${API_BASE}/auth/register`, payload);
  return r.data;
}
export async function apiLogin(email, password) {
  const r = await axios.post(`${API_BASE}/auth/login`, { email, password });
  return r.data;
}
export async function apiGetMe(token) {
  const r = await axios.get(`${API_BASE}/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return r.data;
}
export async function apiDeposit(token, amount) {
  const r = await axios.post(
    `${API_BASE}/wallet/deposit`,
    { amount },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return r.data;
}
export async function apiWithdraw(token, amount) {
  const r = await axios.post(
    `${API_BASE}/wallet/withdraw`,
    { amount },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return r.data;
}
export async function apiSubscribe(token, ticker, units = 1) {
  const r = await axios.post(
    `${API_BASE}/subscribe`,
    { ticker, units },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return r.data;
}
export async function apiUnsubscribe(token, positionId) {
  const r = await axios.post(
    `${API_BASE}/unsubscribe`,
    { positionId },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return r.data;
}
export async function apiHistory(token) {
  const r = await axios.get(`${API_BASE}/profile/history`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return r.data;
}
export async function apiProfileUpdate(token, payload) {
  const r = await axios.post(`${API_BASE}/profile/update`, payload, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return r.data;
}
export async function apiChangePassword(token, oldPassword, newPassword) {
  const r = await axios.post(
    `${API_BASE}/profile/change-password`,
    { oldPassword, newPassword },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return r.data;
}
