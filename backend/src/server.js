require("dotenv").config();

const express = require("express");
const http = require("http");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { v4: uuidv4 } = require("uuid");
const { Server } = require("socket.io");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret";
const PORT = process.env.PORT || 10000;
const SUPPORTED_TICKERS = ["GOOG", "TSLA", "AMZN", "META", "NVDA"];

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: true, credentials: true } });

const socketUser = new Map();
const prices = {};
SUPPORTED_TICKERS.forEach(
  (t) => (prices[t] = +(100 + Math.random() * 3000).toFixed(4))
);

// ---------- AUTH MIDDLEWARE ----------
function auth(req, res, next) {
  const token = (req.headers.authorization || "").split(" ")[1];
  if (!token) return res.status(401).json({ error: "missing token" });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "invalid token" });
  }
}

// ---------- HELPERS ----------
function notify(userId, message, type = "info") {
  for (const [sid, uid] of socketUser) {
    if (uid === userId) {
      const sock = io.sockets.sockets.get(sid);
      sock && sock.emit("notification", { message, type });
    }
  }
}

// ---------- AUTH ROUTES ----------

app.post("/auth/register", async (req, res) => {
  try {
    const { email, password, fullName, dob, accountNumber } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: "email & password required" });

    const exists = await prisma.users.findUnique({ where: { email } });
    if (exists) return res.status(400).json({ error: "email exists" });

    const password_hash = await bcrypt.hash(password, 10);

    const user = await prisma.users.create({
      data: {
        email,
        password_hash,
        full_name: fullName || null,
        dob: dob ? new Date(dob) : null,
        account_number: accountNumber || null,
        wallet_amount: 0,
      },
    });

    const token = jwt.sign({ id: user.id, email }, JWT_SECRET, {
      expiresIn: "8h",
    });

    res.json({ token, user });
  } catch (err) {
    res.status(500).json({ error: "server error" });
  }
});

app.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await prisma.users.findUnique({ where: { email } });
    if (!user) return res.status(400).json({ error: "invalid credentials" });

    const ok = await bcrypt.compare(password, user.password_hash || "");
    if (!ok) return res.status(400).json({ error: "invalid credentials" });

    const token = jwt.sign({ id: user.id, email }, JWT_SECRET, {
      expiresIn: "8h",
    });

    res.json({ token, user });
  } catch {
    res.status(500).json({ error: "server error" });
  }
});

// ---------- ME ----------
app.get("/me", auth, async (req, res) => {
  const user = await prisma.users.findUnique({ where: { id: req.user.id } });
  const positions = await prisma.positions.findMany({
    where: { user_id: req.user.id, active: true },
  });
  res.json({ user, subscriptions: positions, supported: SUPPORTED_TICKERS });
});

// ---------- WALLET ----------
async function changeWallet(userId, amount, type, note) {
  const user = await prisma.users.findUnique({ where: { id: userId } });
  const balanceAfter = Number(user.wallet_amount) + Number(amount);

  const updated = await prisma.users.update({
    where: { id: userId },
    data: { wallet_amount: balanceAfter },
  });

  await prisma.wallet_transactions.create({
    data: {
      user_id: userId,
      amount_change: amount,
      balance_after: balanceAfter,
      type,
      note,
    },
  });

  notify(userId, `${type}: ${amount}. Balance: ${balanceAfter}`);
  return balanceAfter;
}

app.post("/wallet/deposit", auth, async (req, res) => {
  const amount = Number(req.body.amount);
  if (!(amount > 0)) return res.status(400).json({ error: "invalid amount" });
  const balance = await changeWallet(req.user.id, amount, "deposit", "Deposit");
  res.json({ balance });
});

app.post("/wallet/withdraw", auth, async (req, res) => {
  const amount = Number(req.body.amount);
  const user = await prisma.users.findUnique({ where: { id: req.user.id } });
  if (user.wallet_amount < amount)
    return res.status(400).json({ error: "insufficient funds" });

  const balance = await changeWallet(req.user.id, -amount, "withdraw", "Withdraw");
  res.json({ balance });
});

// ---------- TRADE: BUY ----------
app.post("/subscribe", auth, async (req, res) => {
  try {
    const { ticker } = req.body;
    if (!SUPPORTED_TICKERS.includes(ticker))
      return res.status(400).json({ error: "unsupported ticker" });

    const price = prices[ticker];
    const user = await prisma.users.findUnique({ where: { id: req.user.id } });

    if (user.wallet_amount < price)
      return res.status(400).json({ error: "insufficient funds" });

    await changeWallet(req.user.id, -price, "buy", `Bought ${ticker}`);

    const pos = await prisma.positions.create({
      data: {
        user_id: req.user.id,
        ticker,
        units: 1,
        buy_price: price,
      },
    });

    notify(req.user.id, `Bought ${ticker} @ ${price}`);
    res.json({ success: true, pos });
  } catch (err) {
    res.status(500).json({ error: "server error" });
  }
});

// ---------- SELL ----------
app.post("/unsubscribe", auth, async (req, res) => {
  try {
    const { positionId } = req.body;
    const pos = await prisma.positions.findFirst({
      where: { id: positionId, user_id: req.user.id, active: true },
    });

    if (!pos) return res.status(404).json({ error: "not found" });

    const sell_price = prices[pos.ticker];
    const pnl = sell_price - pos.buy_price;

    await prisma.positions.update({
      where: { id: positionId },
      data: { active: false },
    });

    await prisma.position_history.create({
      data: {
        user_id: req.user.id,
        ticker: pos.ticker,
        units: pos.units,
        buy_price: pos.buy_price,
        sell_price,
        buy_ts: pos.buy_ts,
        pnl,
      },
    });

    await changeWallet(
      req.user.id,
      sell_price,
      "sell",
      `Sold ${pos.ticker}`
    );

    notify(req.user.id, `Sold ${pos.ticker} @ ${sell_price}`);
    res.json({ pnl });
  } catch {
    res.status(500).json({ error: "server error" });
  }
});

// ---------- PROFILE ----------
app.post("/profile/update", auth, async (req, res) => {
  const { fullName, dob, accountNumber } = req.body;
  const user = await prisma.users.update({
    where: { id: req.user.id },
    data: {
      full_name: fullName,
      dob: dob ? new Date(dob) : null,
      account_number: accountNumber,
    },
  });
  notify(req.user.id, "Profile updated");
  res.json({ user });
});

app.post("/profile/change-password", auth, async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  const user = await prisma.users.findUnique({ where: { id: req.user.id } });
  const ok = await bcrypt.compare(oldPassword, user.password_hash);
  if (!ok) return res.status(400).json({ error: "wrong password" });

  const newHash = await bcrypt.hash(newPassword, 10);
  await prisma.users.update({
    where: { id: req.user.id },
    data: { password_hash: newHash },
  });
  notify(req.user.id, "Password changed");
  res.json({ success: true });
});

// ---------- HISTORY ----------
app.get("/profile/history", auth, async (req, res) => {
  const history = await prisma.position_history.findMany({
    where: { user_id: req.user.id },
    orderBy: { sell_ts: "desc" },
  });
  const tx = await prisma.wallet_transactions.findMany({
    where: { user_id: req.user.id },
    orderBy: { ts: "desc" },
  });
  res.json({ history, walletTx: tx });
});

// ---------- SOCKET ----------
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    socket.data.userId = payload.id;
    next();
  } catch {
    next(new Error("auth error"));
  }
});

io.on("connection", async (socket) => {
  const uid = socket.data.userId;
  socketUser.set(socket.id, uid);

  const positions = await prisma.positions.findMany({
    where: { user_id: uid, active: true },
  });

  socket.emit("subscribed_list", { tickers: positions });

  socket.on("disconnect", () => socketUser.delete(socket.id));
});

// ---------- PRICE SIMULATION ----------
setInterval(async () => {
  SUPPORTED_TICKERS.forEach((t) => {
    const oldP = prices[t];
    const pct = (Math.random() - 0.5) * 0.01;
    prices[t] = +(oldP * (1 + pct)).toFixed(4);
  });

  for (const [sid, uid] of socketUser.entries()) {
    const sock = io.sockets.sockets.get(sid);
    if (!sock) continue;

    const pos = await prisma.positions.findMany({
      where: { user_id: uid, active: true },
    });

    const watched = new Set(pos.map((p) => p.ticker));

    SUPPORTED_TICKERS.forEach((t) => {
      const payload = {
        ticker: t,
        price: prices[t],
        ts: Date.now(),
      };
      sock.emit(watched.has(t) ? "price_update" : "market_update", payload);
    });
  }
}, 1000);

// ---------- START ----------
server.listen(PORT, () =>
  console.log("Backend running on port " + PORT)
);
