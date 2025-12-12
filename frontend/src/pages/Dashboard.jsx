import React, { useEffect, useState, useRef } from "react";
import { connectSocket, disconnectSocket } from "../services/socket";
import {
  apiGetMe,
  apiSubscribe,
  apiUnsubscribe,
  apiHistory,
  apiProfileUpdate,
  apiChangePassword,
  apiDeposit,
  apiWithdraw,
} from "../services/api";
import ProfileDrawer from "../components/ProfileDrawer";
import NotificationToast from "../components/NotificationToast";
import { sparklinePath } from "../utils/sparkline";
import "../styles.css";

/**
 Dashboard (updated)
 - Bigger market cards (no text cut)
 - Open positions displayed as colored market-style cards
 - Full width layout (fills whole page)
 - Main background color changed via inline style for this page
*/

const CARD_GRADIENTS = [
  "linear-gradient(135deg,#7c5cff,#ff6b6b)",
  "linear-gradient(135deg,#00d2ff,#00b894)",
  "linear-gradient(135deg,#ffd166,#ff6b6b)",
  "linear-gradient(135deg,#7ef192,#00a3ff)",
  "linear-gradient(135deg,#ff9b6b,#ff6bd1)",
  "linear-gradient(135deg,#8b5cf6,#06b6d4)",
];

function MarketCard({
  ticker,
  info = {},
  history = [],
  idx,
  onBuy,
  isPosition,
  position,
  onSell,
}) {
  const price = info?.price ?? (position ? position.buy_price : "--");
  const change = info?.change ?? (position ? price - position.buy_price : 0);
  const ts = info?.ts
    ? new Date(info.ts).toLocaleTimeString()
    : position
    ? new Date(position.buy_ts).toLocaleString()
    : "";
  const grad = CARD_GRADIENTS[idx % CARD_GRADIENTS.length];

  // bigger card sizes & padding to avoid clipping
  return (
    <div
      className="card"
      style={{
        borderRadius: 14,
        padding: 18,
        minHeight: 160,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: "#fff",
        boxShadow: "0 28px 60px rgba(10,10,30,0.06)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* colored header bar (no overlap, placed inside visual area) */}
      <div style={{ position: "relative", zIndex: 2 }}>
        <div
          style={{
            borderRadius: 10,
            padding: 12,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            background: grad,
            color: "#fff",
          }}
        >
          <div>
            <div style={{ fontWeight: 900, fontSize: 16 }}>{ticker}</div>
            <div style={{ fontSize: 12, opacity: 0.95 }}>{ts}</div>
          </div>

          <div style={{ textAlign: "right" }}>
            <div style={{ fontWeight: 900, fontSize: 18 }}>
              {typeof price === "number" ? Number(price).toFixed(4) : price}
            </div>
            <div
              style={{
                color: change > 0 ? "#b3ffd9" : change < 0 ? "#ffd6d6" : "#fff",
                fontWeight: 800,
              }}
            >
              {isPosition
                ? change >= 0
                  ? `+${change.toFixed(4)}`
                  : change.toFixed(4)
                : change >= 0
                ? `+${change}`
                : change}
            </div>
          </div>
        </div>
      </div>

      {/* body — sparkline + actions */}
      <div style={{ marginTop: 12, position: "relative", zIndex: 2 }}>
        <svg width="100%" height="48">
          <path
            d={sparklinePath(history || [])}
            stroke="#246bff"
            strokeWidth="1.6"
            fill="none"
          />
        </svg>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: 12,
          }}
        >
          <div className="muted" style={{ fontSize: 13 }}>
            {isPosition
              ? `Bought @ ${Number(position.buy_price).toFixed(4)}`
              : "Simulated"}
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {isPosition ? (
              <>
                <div
                  style={{
                    color:
                      position && pricesSign(position, info) >= 0
                        ? "#16a34a"
                        : "#ef4444",
                    fontWeight: 800,
                  }}
                >
                  {/* PnL */}
                  {calcPnL(position, info)}
                </div>
                <button onClick={() => onSell(position.id)} className="small">
                  Sell
                </button>
              </>
            ) : (
              <button onClick={() => onBuy(ticker)} className="small">
                Buy
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// helper fns for PnL display
function calcPnL(position, info) {
  if (!position) return "0.0000";
  const cur = info?.price ?? position.buy_price;
  const pnl = position.units * (cur - position.buy_price);
  return Number(pnl).toFixed(4);
}
function pricesSign(position, info) {
  if (!position) return 0;
  const cur = info?.price ?? position.buy_price;
  return cur - position.buy_price;
}

export default function Dashboard({ token, user: initialUser, onLogout }) {
  const [profile, setProfile] = useState(initialUser || null);
  const [supported, setSupported] = useState([]);
  const [positions, setPositions] = useState([]);
  const [prices, setPrices] = useState({});
  const [wallet, setWallet] = useState(
    (initialUser && initialUser.wallet_amount) || 0
  );
  const [showProfile, setShowProfile] = useState(false);
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const [drawerInitialView, setDrawerInitialView] = useState("menu");
  const [toasts, setToasts] = useState([]);
  const socketRef = useRef(null);
  const priceHistory = useRef({});

  useEffect(() => {
    if (!token) return;

    apiGetMe(token)
      .then((res) => {
        setProfile(res.user);
        setSupported(res.supported || []);
        setPositions(res.subscriptions || []);
        setWallet(res.user.wallet_amount || 0);
      })
      .catch(() => {});

    const s = connectSocket(token);
    socketRef.current = s;

    s.on("price_update", (u) => {
      setPrices((p) => ({
        ...p,
        [u.ticker]: { price: u.price, change: u.change, ts: u.ts },
      }));
      addPriceToHistory(u.ticker, u.price);
    });
    s.on("market_update", (u) => {
      setPrices((p) => ({
        ...p,
        [u.ticker]: { price: u.price, change: u.change, ts: u.ts },
      }));
      addPriceToHistory(u.ticker, u.price);
    });
    s.on("subscribed_list", ({ tickers }) => {
      if (Array.isArray(tickers)) setPositions(tickers);
    });
    s.on("notification", (n) => pushToast(n.message, "info"));

    return () => {
      try {
        disconnectSocket(socketRef.current);
      } catch (e) {}
      socketRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  function addPriceToHistory(ticker, price) {
    if (!priceHistory.current[ticker]) priceHistory.current[ticker] = [];
    const arr = priceHistory.current[ticker];
    arr.push(Number(price));
    if (arr.length > 60) arr.shift();
  }

  function pushToast(msg, type = "info") {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, msg, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 6000);
  }

  async function handleBuy(ticker) {
    const price = prices[ticker]?.price;
    if (!price) return pushToast("Price not available", "error");
    const cost = Number((price * 1).toFixed(4));
    if (wallet < cost)
      return pushToast(`Insufficient wallet (need ${cost})`, "error");
    try {
      await apiSubscribe(token, ticker, 1);
      const m = await apiGetMe(token);
      setProfile(m.user);
      setWallet(m.user.wallet_amount);
      setPositions(m.subscriptions || []);
      pushToast(`Bought ${ticker} @ ${price}`, "success");
    } catch (err) {
      pushToast(err?.response?.data?.error || "Buy failed", "error");
    }
  }

  async function handleSell(posId) {
    if (!window.confirm("Sell position?")) return;
    try {
      const r = await apiUnsubscribe(token, posId);
      const m = await apiGetMe(token);
      setProfile(m.user);
      setWallet(m.user.wallet_amount);
      setPositions(m.subscriptions || []);
      pushToast(`Sold. PnL: ${Number(r.pnl).toFixed(4)}`, "success");
    } catch (err) {
      pushToast(err?.response?.data?.error || "Sell failed", "error");
    }
  }

  function openDrawer(view) {
    setDrawerInitialView(view || "menu");
    setShowProfile(true);
    setAvatarMenuOpen(false);
    if (view === "history") {
      apiHistory(token)
        .then((res) => setProfile((p) => ({ ...p, historyData: res })))
        .catch(() => {});
    }
  }

  const avatarContent =
    profile && profile.full_name
      ? profile.full_name
          .split(" ")
          .map((s) => s[0])
          .slice(0, 2)
          .join("")
          .toUpperCase()
      : profile && profile.email
      ? profile.email[0].toUpperCase()
      : "U";

  // Full page gradient background for the dashboard page
  const pageBg = {
    minHeight: "100vh",
    width: "100vw",
    padding: "28px 40px",
    boxSizing: "border-box",
    background:
      "radial-gradient(900px 400px at 6% 12%, rgba(124,92,255,0.06), transparent 8%)," +
      "radial-gradient(700px 300px at 92% 86%, rgba(0,184,148,0.04), transparent 8%)," +
      "linear-gradient(180deg,#f8fbff 0%, #fff 100%)",
  };

  // grid columns bigger so cards are larger
  const gridColumns = {
    display: "grid",
    gap: 18,
    gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
    alignItems: "start",
  };

  return (
    <div style={pageBg}>
      {/* header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 18,
        }}
      >
        <div>
          <h1 style={{ margin: 0 }}>StockDash</h1>
          <div className="muted">Practice trading — simulated market</div>
        </div>

        <div
          style={{
            display: "flex",
            gap: 12,
            alignItems: "center",
            position: "relative",
          }}
        >
          <div style={{ textAlign: "right", minWidth: 140 }}>
            <div className="muted" style={{ fontSize: 12 }}>
              Wallet
            </div>
            <div style={{ fontWeight: 900, fontSize: 18 }}>
              {Number(wallet).toFixed(2)}
            </div>
          </div>

          <div style={{ position: "relative" }}>
            <div
              className="avatar"
              onClick={() => setAvatarMenuOpen((s) => !s)}
              style={{ cursor: "pointer" }}
            >
              {avatarContent}
            </div>

            {avatarMenuOpen && (
              <div
                style={{
                  position: "absolute",
                  right: 0,
                  top: 54,
                  width: 220,
                  background: "linear-gradient(180deg,#fff,#f7fbff)",
                  borderRadius: 12,
                  boxShadow: "0 18px 48px rgba(12,12,30,0.12)",
                  padding: 10,
                  zIndex: 3000,
                }}
              >
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 8 }}
                >
                  <button
                    className="small"
                    onClick={() => openDrawer("profile")}
                  >
                    Profile
                  </button>
                  <button
                    className="small ghost"
                    onClick={() => openDrawer("password")}
                  >
                    Change password
                  </button>
                  <button
                    className="small ghost"
                    onClick={() => openDrawer("history")}
                  >
                    History
                  </button>
                  <button
                    className="small ghost"
                    onClick={() => openDrawer("wallet")}
                  >
                    Add / Remove money
                  </button>
                  <hr
                    style={{
                      margin: "6px 0",
                      border: "none",
                      borderTop: "1px solid rgba(10,10,30,0.04)",
                    }}
                  />
                  <button
                    className="small"
                    onClick={() => {
                      setAvatarMenuOpen(false);
                      onLogout && onLogout();
                    }}
                  >
                    Logout
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Market watch grid (bigger cards) */}
      <div style={{ marginBottom: 26 }}>
        <h3 style={{ margin: "0 0 12px 0" }}>Market Watch</h3>
        <div style={gridColumns}>
          {supported.map((t, idx) => (
            <MarketCard
              key={t}
              ticker={t}
              info={prices[t]}
              history={priceHistory.current[t]}
              idx={idx}
              onBuy={handleBuy}
            />
          ))}
        </div>
      </div>

      {/* Open positions rendered as same market-styled cards (large width rows on desktop) */}
      <div style={{ marginTop: 8 }}>
        <h3 style={{ margin: "0 0 12px 0" }}>Open Positions</h3>

        {positions.length === 0 ? (
          <div className="card">No open positions</div>
        ) : (
          <div
            style={{
              display: "grid",
              gap: 18,
              gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
            }}
          >
            {positions.map((pos, idx) => (
              <MarketCard
                key={pos.id}
                ticker={pos.ticker}
                info={prices[pos.ticker]}
                history={priceHistory.current[pos.ticker]}
                idx={idx}
                isPosition={true}
                position={pos}
                onSell={handleSell}
              />
            ))}
          </div>
        )}
      </div>

      {/* Profile drawer */}
      <ProfileDrawer
        open={showProfile}
        onClose={() => setShowProfile(false)}
        initialView={drawerInitialView}
        profile={profile || {}}
        historyData={(profile && profile.historyData) || null}
        onUpdate={async (payload) => {
          try {
            const r = await apiProfileUpdate(token, payload);
            setProfile(r.user);
            pushToast("Profile updated", "success");
          } catch (err) {
            pushToast("Profile update failed", "error");
          }
        }}
        onChangePassword={async (oldP, newP) => {
          try {
            await apiChangePassword(token, oldP, newP);
            pushToast("Password changed", "success");
          } catch (err) {
            pushToast(
              err?.response?.data?.error || "Change password failed",
              "error"
            );
          }
        }}
        onLoadHistory={async () => {
          try {
            const res = await apiHistory(token);
            setProfile((p) => ({ ...p, historyData: res }));
          } catch {
            pushToast("Failed to load history", "error");
          }
        }}
        onLogout={() => {
          setAvatarMenuOpen(false);
          onLogout && onLogout();
        }}
        onDeposit={async (amt) => {
          try {
            const res = await apiDeposit(token, amt);
            setWallet(res.balance);
            setProfile((p) => ({ ...p, wallet_amount: res.balance }));
            pushToast("Deposit OK", "success");
          } catch {
            pushToast("Deposit failed", "error");
          }
        }}
        onWithdraw={async (amt) => {
          try {
            const res = await apiWithdraw(token, amt);
            setWallet(res.balance);
            setProfile((p) => ({ ...p, wallet_amount: res.balance }));
            pushToast("Withdraw OK", "success");
          } catch {
            pushToast("Withdraw failed", "error");
          }
        }}
      />

      {/* Toasts */}
      <div className="toast-stack" aria-live="polite">
        {toasts.map((t) => (
          <NotificationToast key={t.id} message={t.msg} type={t.type} />
        ))}
      </div>
    </div>
  );
}
