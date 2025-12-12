import React from "react";
import { sparklinePath } from "../utils/sparkline";

export default function TickerCard({ ticker, info = {}, history = [] }) {
  const price = info ? info.price : "--";
  const change = info ? info.change : 0;
  const up = change > 0;
  return (
    <div className="card">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
        }}
      >
        <h3>{ticker}</h3>
        <div style={{ fontSize: 12, color: "#666" }}>
          {info.ts ? new Date(info.ts).toLocaleTimeString() : "--"}
        </div>
      </div>
      <div style={{ fontSize: 22, fontWeight: 700 }}>{price}</div>
      <div style={{ color: up ? "green" : change < 0 ? "red" : "#555" }}>
        {change >= 0 ? `+${change}` : change}
      </div>
      <svg width="100%" height="40">
        <path
          d={sparklinePath(history || [])}
          stroke="#246bff"
          strokeWidth="1.5"
          fill="none"
        />
      </svg>
    </div>
  );
}
