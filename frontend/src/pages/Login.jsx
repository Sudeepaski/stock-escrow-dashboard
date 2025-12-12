import React, { useState } from "react";
import { apiLogin } from "../services/api";
import "./auth.css";

export default function Login({ onLogin, onShowRegister }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setErr("");
    if (!email || !password) {
      setErr("Email & password required");
      return;
    }
    setLoading(true);
    try {
      const res = await apiLogin(email, password);
      onLogin(res.token, res.user);
    } catch (err) {
      setErr(err?.response?.data?.error || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-background">
      <div className="auth-container">
        <div className="auth-left">
          <h1>StockDash</h1>
          <p className="tagline">
            Real-time stocks — simulated prices for practice.
          </p>
          <div className="quote">“Invest in knowledge first.” — Market Tip</div>
          <div className="ads">
            <div className="ad">Premium Insights — Try Pro</div>
            <div className="ad">Refer & Earn — Invite friends</div>
          </div>
          <div className="faq">
            <h4>FAQ</h4>
            <ul>
              <li>
                How real are prices? <strong>Simulated</strong> for demo.
              </li>
              <li>Can I withdraw funds? Yes — try Deposit then Withdraw.</li>
              <li>Contact: sudeepaski2004@gmail.com</li>
            </ul>
          </div>
          <div className="copyright">
            © {new Date().getFullYear()} Sudeep — StockDash
          </div>
        </div>

        <div className="auth-right">
          <div className="card auth-card">
            <h2>Sign in</h2>
            <form onSubmit={handleSubmit}>
              <input
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <input
                placeholder="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button type="submit" disabled={loading}>
                {loading ? "Signing..." : "Sign in"}
              </button>
            </form>
            {err && <div className="error">{err}</div>}
            <div style={{ marginTop: 12 }}>
              <button className="secondary-btn" onClick={onShowRegister}>
                Create account
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
