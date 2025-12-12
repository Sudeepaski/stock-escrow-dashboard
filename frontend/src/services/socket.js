import { io } from "socket.io-client";

let socket = null;
export function connectSocket(token) {
  if (socket && socket.connected) return socket;
  socket = io(import.meta.env.VITE_API_BASE || "https://stock-escrow-dashboard-backend.onrender.com", {
    auth: { token },
    transports: ["websocket"],
  });
  return socket;
}
export function disconnectSocket(s) {
  if (!s) return;
  try {
    s.disconnect();
  } catch (e) {
    /*ignore*/
  }
}
