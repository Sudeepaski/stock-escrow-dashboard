// backend/src/server.js
require("dotenv").config();

// dev safety logs
process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT EXCEPTION", err && err.stack ? err.stack : err);
  process.exit(1);
});
process.on("unhandledRejection", (reason, promise) => {
  console.error(
    "UNHANDLED REJECTION at:",
    promise,
    "reason:",
    reason && reason.stack ? reason.stack : reason
  );
});

const express = require("express");
const http = require("http");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { v4: uuidv4 } = require("uuid");
const { Server } = require("socket.io");
const mysql = require("mysql2/promise");

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret";
const PORT = process.env.PORT || 5000;
const SUPPORTED_TICKERS = ["GOOG", "TSLA", "AMZN", "META", "NVDA"];

// parse DATABASE_URL like mysql://user:pass@host:port/db
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL missing in backend/.env");
  process.exit(1);
}
const dbUrl = new URL(process.env.DATABASE_URL);
const dbUser = decodeURIComponent(dbUrl.username || "root");
const dbPassword = decodeURIComponent(dbUrl.password || "");
const dbHost = dbUrl.hostname || "127.0.0.1";
const dbPort = dbUrl.port ? Number(dbUrl.port) : 3306;
const dbName = dbUrl.pathname ? dbUrl.pathname.replace(/^\//, "") : "stockdash";

const pool = mysql.createPool({
  host: dbHost,
  port: dbPort,
  user: dbUser,
  password: dbPassword,
  database: dbName,
  waitForConnections: true,
  connectionLimit: 10,
  timezone: "Z",
});

// db helpers
async function findUserByEmail(email) {
  const [rows] = await pool.query("SELECT * FROM users WHERE email = ?", [
    email,
  ]);
  return rows[0];
}
async function findUserById(id) {
  const [rows] = await pool.query("SELECT * FROM users WHERE id = ?", [id]);
  return rows[0];
}
async function createUser(email, passwordHash, fullName, dob, accountNumber) {
  const id = uuidv4();
  // wallet always starts at 0
  await pool.query(
    "INSERT INTO users (id, email, password_hash, full_name, dob, account_number, wallet_amount) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [
      id,
      email,
      passwordHash,
      fullName || null,
      dob || null,
      accountNumber || null,
      0.0,
    ]
  );
  const [rows] = await pool.query("SELECT * FROM users WHERE id = ?", [id]);
  return rows[0];
}
async function updateUserProfile(id, fullName, dob, accountNumber) {
  await pool.query(
    "UPDATE users SET full_name=?, dob=?, account_number=? WHERE id=?",
    [fullName, dob, accountNumber, id]
  );
  return findUserById(id);
}
async function updateUserPassword(id, newHash) {
  await pool.query("UPDATE users SET password_hash=? WHERE id=?", [
    newHash,
    id,
  ]);
  return findUserById(id);
}
async function getUserSubscriptions(userId) {
  const [rows] = await pool.query(
    "SELECT * FROM positions WHERE user_id = ? AND active = 1",
    [userId]
  );
  return rows;
}
async function addPosition(userId, ticker, units, buy_price) {
  const id = uuidv4();
  await pool.query(
    "INSERT INTO positions (id, user_id, ticker, units, buy_price, buy_ts) VALUES (?, ?, ?, ?, ?, NOW())",
    [id, userId, ticker, units, buy_price]
  );
  return id;
}
async function closePosition(positionId, userId, sell_price) {
  const [rows] = await pool.query(
    "SELECT * FROM positions WHERE id = ? AND user_id = ?",
    [positionId, userId]
  );
  if (!rows || rows.length === 0) throw new Error("position not found");
  const pos = rows[0];
  const pnl = Number((sell_price - pos.buy_price) * pos.units);
  const histId = uuidv4();
  await pool.query(
    "INSERT INTO position_history (id, user_id, ticker, units, buy_price, sell_price, buy_ts, sell_ts, pnl) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), ?)",
    [
      histId,
      userId,
      pos.ticker,
      pos.units,
      pos.buy_price,
      sell_price,
      pos.buy_ts,
      pnl,
    ]
  );
  await pool.query("UPDATE positions SET active = 0 WHERE id = ?", [
    positionId,
  ]);
  return { pnl, histId, pos };
}

// wallet helpers
async function getWallet(userId) {
  const user = await findUserById(userId);
  return Number(user.wallet_amount);
}
async function changeWallet(userId, amountChange, type, note) {
  const user = await findUserById(userId);
  const balanceBefore = Number(user.wallet_amount);
  const balanceAfter = Number(
    (balanceBefore + Number(amountChange)).toFixed(4)
  );
  await pool.query("UPDATE users SET wallet_amount = ? WHERE id = ?", [
    balanceAfter,
    userId,
  ]);
  await pool.query(
    "INSERT INTO wallet_transactions (id, user_id, amount_change, balance_after, type, note, ts) VALUES (?, ?, ?, ?, ?, ?, NOW())",
    [uuidv4(), userId, amountChange, balanceAfter, type, note || null]
  );
  // emit notification to user
  emitNotificationToUser(userId, {
    type: "wallet",
    message: `${type} ${
      amountChange > 0 ? "added" : "deducted"
    }: ${amountChange}. Balance: ${balanceAfter}`,
  });
  return balanceAfter;
}

// simple helpers
function authMiddleware(req, res, next) {
  const auth = req.headers.authorization || "";
  const token = auth.split(" ")[1];
  if (!token) return res.status(401).json({ error: "missing token" });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload; // id, email
    next();
  } catch (err) {
    return res.status(401).json({ error: "invalid token" });
  }
}

// app + sockets
const app = express();
app.use(cors());
app.use(express.json());
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: true, credentials: true } });

const socketUser = new Map(); // socketId -> userId

// helper to emit notifications to user's sockets
function emitNotificationToUser(userId, payload) {
  for (const [sid, uid] of socketUser.entries()) {
    if (uid === userId) {
      const sock = io.sockets.sockets.get(sid);
      if (sock) sock.emit("notification", payload);
    }
  }
}

// ----------------- AUTH: register & login -----------------

// POST /auth/register
app.post("/auth/register", async (req, res) => {
  try {
    const { email, password, fullName, dob, accountNumber } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: "email & password required" });
    const existing = await findUserByEmail(email);
    if (existing)
      return res.status(400).json({ error: "email already registered" });
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);
    const user = await createUser(
      email,
      hash,
      fullName || null,
      dob || null,
      accountNumber || null
    );
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, {
      expiresIn: "8h",
    });
    // note: wallet starts at 0
    return res.json({ token, user });
  } catch (err) {
    console.error("register error", err);
    return res.status(500).json({ error: "server error" });
  }
});

// POST /auth/login { email, password }
app.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: "email & password required" });
    const user = await findUserByEmail(email);
    if (!user) return res.status(400).json({ error: "invalid credentials" });
    const match = await bcrypt.compare(password, user.password_hash || "");
    if (!match) return res.status(400).json({ error: "invalid credentials" });
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, {
      expiresIn: "8h",
    });
    return res.json({ token, user });
  } catch (err) {
    console.error("login error", err);
    return res.status(500).json({ error: "server error" });
  }
});

// GET /me - returns profile and subscriptions
app.get("/me", authMiddleware, async (req, res) => {
  const user = await findUserById(req.user.id);
  if (!user) return res.status(404).json({ error: "not found" });
  const subs = await getUserSubscriptions(user.id);
  res.json({
    user,
    subscriptions: subs,
    supported: SUPPORTED_TICKERS,
  });
});

// POST /wallet/deposit { amount }
app.post("/wallet/deposit", authMiddleware, async (req, res) => {
  try {
    const amount = Number(req.body.amount || 0);
    if (!(amount > 0)) return res.status(400).json({ error: "invalid amount" });
    const balanceAfter = await changeWallet(
      req.user.id,
      amount,
      "deposit",
      "deposit from UI"
    );
    return res.json({ success: true, balance: balanceAfter });
  } catch (err) {
    console.error("/wallet/deposit", err);
    return res.status(500).json({ error: "server error" });
  }
});

// POST /wallet/withdraw { amount }
app.post("/wallet/withdraw", authMiddleware, async (req, res) => {
  try {
    const amount = Number(req.body.amount || 0);
    if (!(amount > 0)) return res.status(400).json({ error: "invalid amount" });
    const wallet = await getWallet(req.user.id);
    if (wallet < amount)
      return res.status(400).json({ error: "insufficient funds", wallet });
    const balanceAfter = await changeWallet(
      req.user.id,
      -amount,
      "withdraw",
      "withdraw from UI"
    );
    return res.json({ success: true, balance: balanceAfter });
  } catch (err) {
    console.error("/wallet/withdraw", err);
    return res.status(500).json({ error: "server error" });
  }
});

// GET /profile/history - returns closed positions and wallet txns
app.get("/profile/history", authMiddleware, async (req, res) => {
  try {
    const [histRows] = await pool.query(
      "SELECT * FROM position_history WHERE user_id = ? ORDER BY sell_ts DESC",
      [req.user.id]
    );
    const [txRows] = await pool.query(
      "SELECT * FROM wallet_transactions WHERE user_id = ? ORDER BY ts DESC",
      [req.user.id]
    );
    return res.json({ history: histRows, walletTx: txRows });
  } catch (err) {
    console.error("/profile/history", err);
    return res.status(500).json({ error: "server error" });
  }
});

// POST /profile/update { fullName, dob, accountNumber }
app.post("/profile/update", authMiddleware, async (req, res) => {
  try {
    const { fullName, dob, accountNumber } = req.body;
    const updated = await updateUserProfile(
      req.user.id,
      fullName,
      dob,
      accountNumber
    );
    emitNotificationToUser(req.user.id, {
      type: "profile",
      message: "Profile updated",
    });
    return res.json({ success: true, user: updated });
  } catch (err) {
    console.error("/profile/update", err);
    return res.status(500).json({ error: "server error" });
  }
});

// POST /profile/change-password { oldPassword, newPassword }
app.post("/profile/change-password", authMiddleware, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword)
      return res.status(400).json({ error: "old & new passwords required" });
    const user = await findUserById(req.user.id);
    const match = await bcrypt.compare(oldPassword, user.password_hash || "");
    if (!match)
      return res.status(400).json({ error: "old password incorrect" });
    const salt = await bcrypt.genSalt(10);
    const newHash = await bcrypt.hash(newPassword, salt);
    await updateUserPassword(req.user.id, newHash);
    emitNotificationToUser(req.user.id, {
      type: "security",
      message: "Password changed",
    });
    return res.json({ success: true });
  } catch (err) {
    console.error("/profile/change-password", err);
    return res.status(500).json({ error: "server error" });
  }
});

// ----------------- SUBSCRIBE / UNSUBSCRIBE (buy/sell) -----------------

app.post("/subscribe", authMiddleware, async (req, res) => {
  try {
    const { ticker } = req.body;
    const units = Math.max(1, parseInt(req.body.units || "1", 10));
    if (!SUPPORTED_TICKERS.includes(ticker))
      return res.status(400).json({ error: "unsupported ticker" });
    const price = prices[ticker];
    if (!price) return res.status(500).json({ error: "price not available" });
    const cost = Number((price * units).toFixed(4));
    const wallet = await getWallet(req.user.id);
    if (wallet < cost)
      return res
        .status(400)
        .json({ error: "insufficient funds", wallet, required: cost });
    const balanceAfter = await changeWallet(
      req.user.id,
      -cost,
      "subscribe",
      `subscribe ${ticker} x${units} @${price}`
    );
    const posId = await addPosition(req.user.id, ticker, units, price);
    emitNotificationToUser(req.user.id, {
      type: "trade",
      message: `Bought ${ticker} x${units} @ ${price}`,
    });
    return res.json({ success: true, posId, balanceAfter });
  } catch (err) {
    console.error("/subscribe", err);
    return res.status(500).json({ error: "server error" });
  }
});

app.post("/unsubscribe", authMiddleware, async (req, res) => {
  try {
    const { positionId } = req.body;
    if (!positionId)
      return res.status(400).json({ error: "positionId required" });
    const [rows] = await pool.query(
      "SELECT * FROM positions WHERE id = ? AND user_id = ? AND active = 1",
      [positionId, req.user.id]
    );
    if (!rows || rows.length === 0)
      return res.status(404).json({ error: "position not found" });
    const pos = rows[0];
    const sell_price = prices[pos.ticker];
    if (!sell_price)
      return res.status(500).json({ error: "price not available" });
    const result = await closePosition(positionId, req.user.id, sell_price);
    const proceeds = Number((sell_price * pos.units).toFixed(4));
    const balanceAfter = await changeWallet(
      req.user.id,
      proceeds,
      "unsubscribe",
      `sell ${pos.ticker} x${pos.units} @${sell_price}`
    );
    emitNotificationToUser(req.user.id, {
      type: "trade",
      message: `Sold ${pos.ticker} x${
        pos.units
      } @ ${sell_price} (PnL ${result.pnl.toFixed(4)})`,
    });
    return res.json({
      success: true,
      pnl: result.pnl,
      balanceAfter,
      histId: result.histId,
    });
  } catch (err) {
    console.error("/unsubscribe", err);
    return res.status(500).json({ error: "server error" });
  }
});

// ----------------- Socket.IO -----------------

io.use(async (socket, next) => {
  const token = socket.handshake.auth && socket.handshake.auth.token;
  if (!token) return next(new Error("Authentication error"));
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = await findUserById(payload.id);
    if (!user) return next(new Error("User not found"));
    socket.data.userId = user.id;
    return next();
  } catch (err) {
    return next(new Error("Authentication error"));
  }
});

io.on("connection", async (socket) => {
  const userId = socket.data.userId;
  console.log("Socket connected", socket.id, "userId=", userId);
  socketUser.set(socket.id, userId);

  // send current active positions
  const currentSubs = await getUserSubscriptions(userId);
  socket.emit("subscribed_list", { tickers: currentSubs });

  socket.on("disconnect", () => {
    socketUser.delete(socket.id);
  });
});

// ----------------- Price generator -----------------
const prices = {};
SUPPORTED_TICKERS.forEach((t) => {
  prices[t] = +(100 + Math.random() * 3900).toFixed(4);
});
function randomWalkPrice(oldPrice) {
  const pct = (Math.random() - 0.5) * 0.016;
  const newP = oldPrice * (1 + pct);
  return +newP.toFixed(4);
}

setInterval(async () => {
  const updates = [];
  SUPPORTED_TICKERS.forEach((t) => {
    const oldP = prices[t];
    const newP = randomWalkPrice(oldP);
    const change = +(newP - oldP).toFixed(4);
    prices[t] = newP;
    updates.push({ ticker: t, price: newP, change, ts: Date.now() });
  });

  for (const [sid, uid] of socketUser.entries()) {
    const sock = io.sockets.sockets.get(sid);
    if (!sock) continue;
    const subs = await getUserSubscriptions(uid);
    const tickers = new Set(subs.map((s) => s.ticker));
    updates.forEach((u) => {
      if (tickers.has(u.ticker)) {
        sock.emit("price_update", u);
      } else {
        sock.emit("market_update", u);
      }
    });
  }
}, 1000);

// start server
server.listen(PORT, () =>
  console.log(`Backend listening on http://localhost:${PORT}`)
);
