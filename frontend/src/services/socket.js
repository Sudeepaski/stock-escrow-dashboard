import { io } from "socket.io-client";

let socket = null;

export function connectSocket(token) {
  if (socket && socket.connected) return socket;

  const BASE =
    import.meta.env.VITE_API_BASE ||
    "https://stock-escrow-dashboard-backend.onrender.com";

  socket = io(BASE, {
    auth: { token },
    transports: ["websocket"],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
  });

  return socket;
}

export function disconnectSocket(sock) {
  if (!sock) return;
  try {
    sock.disconnect();
  } catch (_) {}
}
