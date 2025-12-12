import React from "react";

export default function SubscriptionPanel({
  supported,
  subscribed,
  onSubscribe,
  onUnsubscribe,
}) {
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {supported.map((t) => {
        const isSub = subscribed.includes(t);
        return (
          <div key={t} className="chip">
            <div style={{ fontWeight: 700 }}>{t}</div>
            {isSub ? (
              <button onClick={() => onUnsubscribe(t)} className="mini">
                Unsub
              </button>
            ) : (
              <button onClick={() => onSubscribe(t)} className="mini">
                Sub
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
