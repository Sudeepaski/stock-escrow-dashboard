import React from "react";
import "./toast.css";

/**
 * NotificationToast
 * props:
 *  - message: string
 *  - type: 'info' | 'success' | 'error' (optional, defaults to 'info')
 */
export default function NotificationToast({ message, type = "info" }) {
  const icon = type === "success" ? "✅" : type === "error" ? "⚠️" : "🔔";
  return (
    <div className={`toast toast-${type}`} role="status" aria-live="polite">
      <div className="toast-inner">
        <div className="toast-icon">{icon}</div>
        <div className="toast-msg">{message}</div>
      </div>
    </div>
  );
}
