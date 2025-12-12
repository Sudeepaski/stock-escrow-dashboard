import React, { useState, useEffect } from "react";
import "./drawer.css";

/**
 Views:
  menu → Profile / Change Password / History / Wallet / Logout
  profile
  edit
  password
  history
  wallet
*/

export default function ProfileDrawer({
  open,
  onClose,
  initialView,
  profile,
  historyData,
  onUpdate,
  onChangePassword,
  onLoadHistory,
  onDeposit,
  onWithdraw,
  onLogout,
}) {
  const [view, setView] = useState(initialView || "menu");

  const [editForm, setEditForm] = useState({
    fullName: "",
    dob: "",
    accountNumber: "",
  });

  const [oldPass, setOldPass] = useState("");
  const [newPass, setNewPass] = useState("");

  const [dep, setDep] = useState("");
  const [withd, setWithd] = useState("");

  useEffect(() => {
    if (open) {
      setView(initialView || "menu");
      setEditForm({
        fullName: profile.full_name || "",
        dob: profile.dob || "",
        accountNumber: profile.account_number || "",
      });
    }
  }, [open, initialView, profile]);

  if (!open) return null;

  // ---------- MENU ----------
  if (view === "menu") {
    return (
      <div className="drawer">
        <div className="drawer-header">
          <h3>Account</h3>
          <button className="close-btn" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="menu-list">
          <button onClick={() => setView("profile")}>Profile</button>
          <button onClick={() => setView("password")}>Change Password</button>
          <button
            onClick={() => {
              setView("history");
              onLoadHistory();
            }}
          >
            History
          </button>
          <button onClick={() => setView("wallet")}>Add / Remove Money</button>

          <button className="logout-btn" onClick={onLogout}>
            Logout
          </button>
        </div>
      </div>
    );
  }

  // ---------- PROFILE ----------
  if (view === "profile") {
    return (
      <div className="drawer">
        <div className="drawer-header">
          <button className="back-btn" onClick={() => setView("menu")}>
            Back
          </button>
          <h3>Profile</h3>
        </div>

        <div className="drawer-body-view">
          <p>
            <strong>Name:</strong> {profile.full_name}
          </p>
          <p>
            <strong>Email:</strong> {profile.email}
          </p>
          <p>
            <strong>Account:</strong> {profile.account_number}
          </p>
          <p>
            <strong>DOB:</strong> {profile.dob}
          </p>
          <p>
            <strong>Wallet:</strong> {Number(profile.wallet_amount).toFixed(2)}
          </p>

          <button onClick={() => setView("edit")}>Edit Profile</button>
        </div>
      </div>
    );
  }

  // ---------- EDIT PROFILE ----------
  if (view === "edit") {
    return (
      <div className="drawer">
        <div className="drawer-header">
          <button className="back-btn" onClick={() => setView("profile")}>
            Back
          </button>
          <h3>Edit Profile</h3>
        </div>

        <div className="drawer-body-view">
          <input
            placeholder="Full name"
            value={editForm.fullName}
            onChange={(e) =>
              setEditForm({ ...editForm, fullName: e.target.value })
            }
          />
          <input
            placeholder="DOB"
            value={editForm.dob}
            onChange={(e) => setEditForm({ ...editForm, dob: e.target.value })}
          />
          <input
            placeholder="Account number"
            value={editForm.accountNumber}
            onChange={(e) =>
              setEditForm({ ...editForm, accountNumber: e.target.value })
            }
          />

          <button
            onClick={() => {
              onUpdate({
                fullName: editForm.fullName,
                dob: editForm.dob,
                accountNumber: editForm.accountNumber,
              });
              setView("profile");
            }}
          >
            Save
          </button>
        </div>
      </div>
    );
  }

  // ---------- CHANGE PASSWORD ----------
  if (view === "password") {
    return (
      <div className="drawer">
        <div className="drawer-header">
          <button className="back-btn" onClick={() => setView("menu")}>
            Back
          </button>
          <h3>Change Password</h3>
        </div>

        <div className="drawer-body-view">
          <input
            type="password"
            placeholder="Old password"
            value={oldPass}
            onChange={(e) => setOldPass(e.target.value)}
          />
          <input
            type="password"
            placeholder="New password"
            value={newPass}
            onChange={(e) => setNewPass(e.target.value)}
          />

          <button
            onClick={() => {
              onChangePassword(oldPass, newPass);
              setOldPass("");
              setNewPass("");
              setView("menu");
            }}
          >
            Change Password
          </button>
        </div>
      </div>
    );
  }

  // ---------- HISTORY ----------
  if (view === "history") {
    return (
      <div className="drawer">
        <div className="drawer-header">
          <button className="back-btn" onClick={() => setView("menu")}>
            Back
          </button>
          <h3>History</h3>
        </div>

        <div className="drawer-body-view">
          {!historyData?.history?.length && <p>No history found.</p>}

          {historyData?.history?.map((h) => (
            <div key={h.id} className="history-item">
              <strong>{h.ticker}</strong> x{h.units}
              <p>
                Buy: {h.buy_price} | Sell: {h.sell_price}
              </p>
              <p style={{ color: h.pnl >= 0 ? "green" : "red" }}>
                PnL: {h.pnl}
              </p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ---------- WALLET ----------
  if (view === "wallet") {
    return (
      <div className="drawer">
        <div className="drawer-header">
          <button className="back-btn" onClick={() => setView("menu")}>
            Back
          </button>
          <h3>Wallet</h3>
        </div>

        <div className="drawer-body-view">
          <p>
            <strong>Current Balance: </strong>
            {Number(profile.wallet_amount).toFixed(2)}
          </p>

          <input
            placeholder="Deposit amount"
            value={dep}
            onChange={(e) => setDep(e.target.value)}
          />
          <button
            onClick={() => {
              onDeposit(Number(dep));
              setDep("");
            }}
          >
            Deposit
          </button>

          <input
            placeholder="Withdraw amount"
            value={withd}
            onChange={(e) => setWithd(e.target.value)}
          />
          <button
            onClick={() => {
              onWithdraw(Number(withd));
              setWithd("");
            }}
          >
            Withdraw
          </button>
        </div>
      </div>
    );
  }
}
