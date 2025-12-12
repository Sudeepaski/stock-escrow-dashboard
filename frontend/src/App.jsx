import React, { useEffect, useState } from "react";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import { apiGetMe } from "./services/api";

export default function App() {
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [user, setUser] = useState(null);
  const [showRegister, setShowRegister] = useState(false);

  useEffect(() => {
    if (!token) {
      setUser(null);
      return;
    }
    apiGetMe(token)
      .then((res) => {
        setUser(res.user);
      })
      .catch(() => {
        setToken(null);
        localStorage.removeItem("token");
        setUser(null);
      });
  }, [token]);

  function handleLogin(t, u) {
    localStorage.setItem("token", t);
    setToken(t);
    setUser(u);
  }
  function handleLogout() {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
  }

  if (!token) {
    return showRegister ? (
      <Register onRegistered={handleLogin} />
    ) : (
      <Login
        onLogin={handleLogin}
        onShowRegister={() => setShowRegister(true)}
      />
    );
  }
  if (!user) return <div style={{ padding: 20 }}>Loading profile...</div>;
  return <Dashboard token={token} user={user} onLogout={handleLogout} />;
}
