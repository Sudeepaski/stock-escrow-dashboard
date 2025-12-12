import React, { useState, useEffect, useRef } from "react";
import { apiRegister } from "../services/api";
import "./auth.css";

const ADS = [
  {
    id: 1,
    title: "Welcome Offer: Practice balance 0",
    body: "Start practicing with simulated funds — perfect for learning.",
  },
  {
    id: 2,
    title: "Learn: Tips and guides",
    body: "Short tutorials and tips to help you understand trading basics.",
  },
  {
    id: 3,
    title: "Refer & Earn",
    body: "Invite friends and earn rewards for every new signup.",
  },
];

function strengthScore(pw) {
  let score = 0;
  if (!pw) return 0;
  if (pw.length >= 8) score += 1;
  if (/[A-Z]/.test(pw)) score += 1;
  if (/[0-9]/.test(pw)) score += 1;
  if (/[^A-Za-z0-9]/.test(pw)) score += 1;
  return score; // 0..4
}

export default function Register({ onRegistered }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [fullName, setFullName] = useState("");
  const [dob, setDob] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  // ads carousel
  const [adIdx, setAdIdx] = useState(0);
  const adTimerRef = useRef(null);
  useEffect(() => {
    adTimerRef.current = setInterval(() => {
      setAdIdx((i) => (i + 1) % ADS.length);
    }, 4000);
    return () => clearInterval(adTimerRef.current);
  }, []);

  const score = strengthScore(password);
  const scoreLabels = ["Too weak", "Okay", "Good", "Strong", "Great"];

  async function handleSubmit(e) {
    e.preventDefault();
    setErr("");
    // client-side validation
    if (!email || !password) {
      setErr("Email & password required");
      return;
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      setErr("Enter a valid email address");
      return;
    }
    if (score < 2) {
      setErr(
        "Password too weak — include length, uppercase, numbers or symbols"
      );
      return;
    }

    setLoading(true);
    try {
      const payload = { email, password, fullName, dob, accountNumber };
      // register always gets wallet 0 on server side
      const res = await apiRegister(payload);
      onRegistered(res.token, res.user);
    } catch (err) {
      setErr(err?.response?.data?.error || "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-background">
      <div className="auth-container">
        <div className="auth-left">
          <h1>Create Account</h1>
          <p className="tagline">
            Join StockDash and practice trading with simulated markets.
          </p>

          {/* Ad carousel */}
          <div className="ads" aria-live="polite">
            {ADS.map((a, i) => (
              <div
                key={a.id}
                className="ad"
                style={{
                  display: i === adIdx ? "block" : "none",
                  transition: "opacity .4s ease",
                }}
              >
                <div style={{ fontWeight: 800, marginBottom: 6 }}>
                  {a.title}
                </div>
                <div style={{ color: "#4b5563" }}>{a.body}</div>
              </div>
            ))}
          </div>

          <div className="why-us" style={{ marginTop: 12 }}>
            <h4>Why us?</h4>
            <ul>
              <li>Simulated real-time prices — safe practice environment</li>
              <li>Simple buy/sell with wallet & history tracking</li>
              <li>Realistic UX for learning trading flows</li>
            </ul>
          </div>

          <div className="faq" style={{ marginTop: 12 }}>
            <h4>FAQ</h4>
            <ul>
              <li>
                How real are prices? <strong>Simulated</strong> for demo.
              </li>
              <li>
                Can I withdraw? Yes — deposit then withdraw from the dashboard.
              </li>
              <li>Contact: sudeepaski2004@gmail.com</li>
            </ul>
          </div>

          <div className="copyright">
            © {new Date().getFullYear()} Sudeep — StockDash
          </div>
        </div>

        <div className="auth-right">
          <div className="card auth-card">
            <h2>Create account</h2>
            <p className="sub">
              Start practicing trading — your wallet starts at ₹0.
            </p>

            <form onSubmit={handleSubmit} style={{ marginTop: 12 }}>
              <input
                placeholder="Full name (optional)"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                autoComplete="name"
              />

              <input
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />

              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  placeholder="Password"
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="ghost"
                  onClick={() => setShowPw((s) => !s)}
                  style={{ height: 44, alignSelf: "center" }}
                >
                  {showPw ? "Hide" : "Show"}
                </button>
              </div>

              {/* password strength */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginTop: 6,
                }}
              >
                <div
                  style={{
                    flex: 1,
                    height: 8,
                    background: "#f1f5f9",
                    borderRadius: 8,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${(score / 4) * 100}%`,
                      height: "100%",
                      background:
                        score >= 3
                          ? "linear-gradient(90deg,#06b6a4,#34d399)"
                          : score >= 2
                          ? "linear-gradient(90deg,#f59e0b,#f97316)"
                          : "linear-gradient(90deg,#ef4444,#fb7185)",
                      transition: "width .25s ease",
                    }}
                  />
                </div>
                <div
                  style={{
                    minWidth: 80,
                    textAlign: "right",
                    fontWeight: 700,
                    color: "#334155",
                  }}
                >
                  {scoreLabels[score]}
                </div>
              </div>

              <input
                placeholder="DOB (YYYY-MM-DD)"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
              />
              <input
                placeholder="Account number (optional)"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
              />

              <button
                type="submit"
                disabled={loading}
                style={{ marginTop: 12 }}
              >
                {loading ? "Creating account..." : "Create Account"}
              </button>
            </form>

            {err && (
              <div className="error" style={{ marginTop: 10 }}>
                {err}
              </div>
            )}

            <div
              style={{
                marginTop: 12,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div style={{ fontSize: 13, color: "#6b7280" }}>
                Already have an account?
              </div>
              {/* keep the parent-driven navigation */}
              <button
                className="secondary-btn"
                onClick={() => onRegistered && onRegistered(null, null)}
              >
                Sign in
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
