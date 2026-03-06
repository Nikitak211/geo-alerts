// oref-ws-server.js (CommonJS)
const crypto = require("crypto");
const express = require("express");
const { WebSocketServer } = require("ws");
const { Pool } = require("pg");

const OREF_URL = "https://www.oref.org.il/WarningMessages/alert/alerts.json";

const OREF_HEADERS = {
  Referer: "https://www.oref.org.il/",
  "X-Requested-With": "XMLHttpRequest",
  "User-Agent": "Mozilla/5.0",
  Accept: "application/json",
};

const PORT = Number(process.env.PORT || 8080);
const HTTP_PORT = Number(process.env.HTTP_PORT || 8090);
const BET_EXPIRY_GRACE_MS = 60 * 1000; // 1 minute grace around predicted time

function hashPassword(password) {
  return crypto.createHash("sha256").update(String(password)).digest("hex");
}

function normalizeEmail(email) {
  return String(email || "")
    .trim()
    .toLowerCase();
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

function normalizeAreaName(name) {
  return String(name || "")
    .trim()
    .replace(/\s+/g, " ");
}

function getAlertDateParts(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return { yyyy, mm, dd, dateStr: `${yyyy}-${mm}-${dd}` };
}

function parsePredictedTimestampLocal(betDate, predictedTime) {
  return new Date(`${betDate}T${predictedTime}:00`);
}

function toDateOnlyString(value) {
  if (value instanceof Date) {
    const yyyy = value.getFullYear();
    const mm = String(value.getMonth() + 1).padStart(2, "0");
    const dd = String(value.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  const s = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return s.slice(0, 10);
}

const app = express();
app.use(express.json());
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "http://localhost:3000");
  res.header(
    "Access-Control-Allow-Methods",
    "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  );
  res.header("Access-Control-Allow-Headers", "Content-Type, x-user-id");
  res.header("Access-Control-Allow-Credentials", "true");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL || "postgres://app:app@localhost:5432/bets",
});

const wss = new WebSocketServer({ port: PORT });
console.log(`WS server running on ws://localhost:${PORT}`);

wss.on("connection", (ws) => {
  ws.send(JSON.stringify({ type: "hello", ts: Date.now() }));
});

let lastHash = null;

const hash = (obj) =>
  crypto.createHash("sha256").update(JSON.stringify(obj)).digest("hex");

function broadcast(data) {
  const msg = JSON.stringify(data);
  for (const client of wss.clients) {
    if (client.readyState === 1) {
      client.send(msg);
    }
  }
}

/**
 * Oref payload shape can vary.
 * Commonly "data" is an array of area names.
 * We normalize to:
 * [{ areaHeb, alertTime }]
 */
function extractAlerts(payload, now) {
  const alerts = [];

  if (!payload) return alerts;

  const alertTime = payload.alertDate || payload.alertTime || now.toISOString();

  if (Array.isArray(payload.data)) {
    for (const rawArea of payload.data) {
      const areaHeb = normalizeAreaName(rawArea);
      if (areaHeb) {
        alerts.push({
          areaHeb,
          alertTime,
        });
      }
    }
  }

  return alerts;
}

async function settleAreaAlert({ areaHeb, alertTime }) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const alertTs = new Date(alertTime);
    const { dateStr: alertDate } = getAlertDateParts(alertTs);

    // idempotency for same area + exact alert time
    const insertedAlert = await client.query(
      `
      INSERT INTO alerts (area_heb, alert_time, alert_date, raw_area_key)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (area_heb, alert_time) DO NOTHING
      RETURNING id
      `,
      [areaHeb, alertTs.toISOString(), alertDate, areaHeb],
    );

    if (insertedAlert.rowCount === 0) {
      await client.query("ROLLBACK");
      return {
        ok: true,
        areaHeb,
        alertTime,
        note: "already settled",
      };
    }

    const alertId = insertedAlert.rows[0].id;

    const betsRes = await client.query(
      `
      SELECT
        id,
        user_id,
        area_heb,
        bet_date,
        predicted_time,
        amount,
        status
      FROM bets
      WHERE area_heb = $1
        AND bet_date = $2
        AND status = 'open'
      FOR UPDATE
      `,
      [areaHeb, alertDate],
    );

    const bets = betsRes.rows;

    if (!bets.length) {
      await client.query("COMMIT");
      return {
        ok: true,
        areaHeb,
        alertTime,
        winners: [],
        totalPot: 0,
        platformFee: 0,
        note: "no bets for area/date",
      };
    }

    const scored = bets.map((bet) => {
      const predictedTs = parsePredictedTimestampLocal(
        toDateOnlyString(bet.bet_date),
        bet.predicted_time,
      );

      const diffMs = Math.abs(alertTs.getTime() - predictedTs.getTime());

      return {
        ...bet,
        predictedTs,
        diffMs,
      };
    });

    scored.sort((a, b) => a.diffMs - b.diffMs);

    const bestDiff = scored[0].diffMs;
    const winners = scored.filter((b) => b.diffMs === bestDiff);

    const totalPot = round2(
      scored.reduce((sum, bet) => sum + Number(bet.amount), 0),
    );
    const platformFee = round2(totalPot * 0.1);
    const distributable = round2(totalPot - platformFee);
    const payoutEach = round2(distributable / winners.length);

    const winnerIds = winners.map((w) => w.id);
    const allBetIds = scored.map((b) => b.id);

    await client.query(
      `
      UPDATE bets
      SET
        status = CASE WHEN id = ANY($1) THEN 'won' ELSE 'lost' END,
        settled_alert_time = $2,
        payout_amount = CASE WHEN id = ANY($1) THEN $3 ELSE 0 END
      WHERE id = ANY($4)
      `,
      [winnerIds, alertTs.toISOString(), payoutEach, allBetIds],
    );

    for (const winner of winners) {
      await client.query(
        `
        UPDATE users
        SET balance = balance + $1
        WHERE id = $2
        `,
        [payoutEach, winner.user_id],
      );

      await client.query(
        `
        INSERT INTO wallet_ledger (user_id, kind, amount, ref_type, ref_id, note)
        VALUES ($1, 'win_payout', $2, 'alert', $3, $4)
        `,
        [
          winner.user_id,
          payoutEach,
          String(alertId),
          `Payout for area ${areaHeb} alert at ${alertTs.toISOString()}`,
        ],
      );
    }

    await client.query(
      `
      INSERT INTO platform_revenue (alert_id, amount, area_heb, alert_time)
      VALUES ($1, $2, $3, $4)
      `,
      [alertId, platformFee, areaHeb, alertTs.toISOString()],
    );

    await client.query("COMMIT");

    const result = {
      ok: true,
      areaHeb,
      alertTime: alertTs.toISOString(),
      totalPot,
      platformFee,
      distributable,
      payoutEach,
      winners: winners.map((w) => ({
        betId: w.id,
        userId: w.user_id,
        predictedTime: w.predicted_time,
      })),
      bestDiffMs: bestDiff,
    };

    broadcast({
      type: "bet_settlement",
      ts: Date.now(),
      payload: result,
    });

    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function processAlertPayload(json) {
  const now = new Date();
  const alerts = extractAlerts(json, now);

  if (!alerts.length) return [];

  const results = [];
  for (const alert of alerts) {
    try {
      const result = await settleAreaAlert(alert);
      results.push(result);
    } catch (e) {
      console.error("settle error:", e?.message ?? e);
      results.push({
        ok: false,
        areaHeb: alert.areaHeb,
        error: e?.message ?? String(e),
      });
    }
  }

  return results;
}

/**
 * Every 3 seconds:
 * - find open bets whose predicted time window already passed
 * - if no alert exists for the same area/date within ± grace window
 * - mark them as lost
 */
async function expireMissedBets() {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const openBetsRes = await client.query(
      `
      SELECT
        id,
        user_id,
        area_heb,
        bet_date,
        predicted_time,
        amount,
        status
      FROM bets
      WHERE status = 'open'
      FOR UPDATE
      `,
    );

    const now = Date.now();
    const expiredBetIds = [];

    for (const bet of openBetsRes.rows) {
      const betDate = toDateOnlyString(bet.bet_date);
      const predictedTs = parsePredictedTimestampLocal(
        betDate,
        bet.predicted_time,
      );

      const expiryTs = predictedTs.getTime() + BET_EXPIRY_GRACE_MS;

      if (now <= expiryTs) {
        continue;
      }

      const fromTs = new Date(predictedTs.getTime() - BET_EXPIRY_GRACE_MS);
      const toTs = new Date(predictedTs.getTime() + BET_EXPIRY_GRACE_MS);

      const alertCheck = await client.query(
        `
        SELECT id
        FROM alerts
        WHERE area_heb = $1
          AND alert_date = $2
          AND alert_time BETWEEN $3 AND $4
        LIMIT 1
        `,
        [bet.area_heb, betDate, fromTs.toISOString(), toTs.toISOString()],
      );

      if (alertCheck.rows[0]) {
        continue;
      }

      expiredBetIds.push(bet.id);
    }

    if (expiredBetIds.length > 0) {
      await client.query(
        `
        UPDATE bets
        SET
          status = 'lost',
          payout_amount = 0
        WHERE id = ANY($1)
          AND status = 'open'
        `,
        [expiredBetIds],
      );
    }

    await client.query("COMMIT");

    if (expiredBetIds.length > 0) {
      const payload = {
        type: "bets_expired",
        ts: Date.now(),
        payload: {
          count: expiredBetIds.length,
          betIds: expiredBetIds,
        },
      };

      broadcast(payload);
      console.log("Expired missed bets:", expiredBetIds);
    }
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("expireMissedBets error:", e?.message ?? e);
  } finally {
    client.release();
  }
}

async function pollOnce() {
  const res = await fetch(OREF_URL, {
    method: "GET",
    headers: OREF_HEADERS,
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }

  const text = await res.text();

  if (!text || text.trim() === "") {
    return;
  }

  let json;
  try {
    json = JSON.parse(text);
  } catch (e) {
    console.error("JSON parse failed:", e?.message ?? e);
    return;
  }

  const h = hash(json);

  if (lastHash && h !== lastHash) {
    broadcast({
      type: "oref_update",
      ts: Date.now(),
      payload: json,
    });

    const settlementResults = await processAlertPayload(json);

    if (settlementResults.length) {
      console.log("settlementResults:", settlementResults);
    }
  }

  lastHash = h;
}

async function loop() {
  while (true) {
    try {
      await pollOnce();
      await sleep(3000);
    } catch (e) {
      console.error("poll error:", e?.message ?? e);
      await sleep(5000);
    }
  }
}

async function expiryLoop() {
  while (true) {
    try {
      await expireMissedBets();
      await sleep(3000);
    } catch (e) {
      console.error("expiry loop error:", e?.message ?? e);
      await sleep(3000);
    }
  }
}

// very simple auth placeholder
function requireUser(req, res, next) {
  const userId = req.header("x-user-id");
  if (!userId) {
    return res.status(401).json({ error: "Missing x-user-id" });
  }
  req.userId = userId;
  next();
}

/* -------------------------
   HTTP API
------------------------- */

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/api/register", async (req, res) => {
  const { email, password } = req.body || {};
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    return res.status(400).json({ error: "email is required" });
  }

  if (!password || String(password).length < 4) {
    return res.status(400).json({ error: "password must be at least 4 chars" });
  }

  const existing = await pool.query(`SELECT id FROM users WHERE email = $1`, [
    normalizedEmail,
  ]);

  if (existing.rows[0]) {
    return res.status(400).json({ error: "User already exists" });
  }

  const id = crypto.randomUUID();
  const passwordHash = hashPassword(password);

  await pool.query(
    `
    INSERT INTO users (id, email, password_hash, balance)
    VALUES ($1, $2, $3, $4)
    `,
    [id, normalizedEmail, passwordHash, 0],
  );

  const result = await pool.query(
    `SELECT id, email, balance FROM users WHERE id = $1`,
    [id],
  );

  res.json({
    ok: true,
    user: result.rows[0],
  });
});

app.post("/api/login", async (req, res) => {
  const { email, password } = req.body || {};
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail || !password) {
    return res.status(400).json({ error: "email and password are required" });
  }

  const passwordHash = hashPassword(password);

  const result = await pool.query(
    `
    SELECT id, email, balance
    FROM users
    WHERE email = $1 AND password_hash = $2
    `,
    [normalizedEmail, passwordHash],
  );

  if (!result.rows[0]) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  res.json({
    ok: true,
    user: result.rows[0],
  });
});

app.post("/api/logout", async (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/me", requireUser, async (req, res) => {
  const result = await pool.query(
    `SELECT id, email, balance FROM users WHERE id = $1`,
    [req.userId],
  );

  if (!result.rows[0]) {
    return res.status(404).json({ error: "User not found" });
  }

  res.json(result.rows[0]);
});

app.get("/api/payment-methods", requireUser, async (req, res) => {
  const result = await pool.query(
    `
    SELECT id, label, provider
    FROM payment_methods
    WHERE user_id = $1
    ORDER BY created_at DESC
    `,
    [req.userId],
  );

  res.json(result.rows);
});

app.post("/api/payment-methods", requireUser, async (req, res) => {
  const { label, provider = "manual", token = null } = req.body || {};

  if (!label) {
    return res.status(400).json({ error: "label is required" });
  }

  const id = crypto.randomUUID();

  await pool.query(
    `
    INSERT INTO payment_methods (id, user_id, label, provider, token)
    VALUES ($1, $2, $3, $4, $5)
    `,
    [id, req.userId, label, provider, token],
  );

  res.json({ id, ok: true });
});

app.delete("/api/payment-methods/:id", requireUser, async (req, res) => {
  const { id } = req.params;

  const result = await pool.query(
    `
    DELETE FROM payment_methods
    WHERE id = $1 AND user_id = $2
    RETURNING id
    `,
    [id, req.userId],
  );

  if (!result.rows[0]) {
    return res.status(404).json({ error: "Payment method not found" });
  }

  res.json({ ok: true, id });
});

app.post("/api/deposit", requireUser, async (req, res) => {
  const { amount, paymentMethodId } = req.body || {};
  const numericAmount = Number(amount);

  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    return res.status(400).json({ error: "amount must be > 0" });
  }

  if (!paymentMethodId) {
    return res.status(400).json({ error: "paymentMethodId is required" });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const pmCheck = await client.query(
      `
      SELECT id
      FROM payment_methods
      WHERE id = $1 AND user_id = $2
      `,
      [paymentMethodId, req.userId],
    );

    if (!pmCheck.rows[0]) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Invalid payment method" });
    }

    const userRes = await client.query(
      `SELECT id, balance FROM users WHERE id = $1 FOR UPDATE`,
      [req.userId],
    );

    if (!userRes.rows[0]) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "User not found" });
    }

    await client.query(
      `
      UPDATE users
      SET balance = balance + $1
      WHERE id = $2
      `,
      [numericAmount, req.userId],
    );

    await client.query(
      `
      INSERT INTO wallet_ledger (user_id, kind, amount, ref_type, ref_id, note)
      VALUES ($1, 'deposit', $2, 'payment_method', $3, $4)
      `,
      [
        req.userId,
        numericAmount,
        String(paymentMethodId),
        `Manual deposit of ${numericAmount} via payment method ${paymentMethodId}`,
      ],
    );

    await client.query("COMMIT");

    const updated = await pool.query(
      `SELECT id, email, balance FROM users WHERE id = $1`,
      [req.userId],
    );

    res.json({
      ok: true,
      user: updated.rows[0],
    });
  } catch (e) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: e?.message ?? "server error" });
  } finally {
    client.release();
  }
});

app.get("/api/bets/summary", requireUser, async (req, res) => {
  const result = await pool.query(
    `
    SELECT
      COUNT(*) FILTER (WHERE status = 'open') AS open_count,
      COUNT(*) FILTER (WHERE status = 'won') AS won_count,
      COUNT(*) FILTER (WHERE status = 'lost') AS lost_count,
      COUNT(*) FILTER (WHERE status = 'void') AS void_count
    FROM bets
    WHERE user_id = $1
    `,
    [req.userId],
  );

  res.json(
    result.rows[0] || {
      open_count: 0,
      won_count: 0,
      lost_count: 0,
      void_count: 0,
    },
  );
});

app.post("/api/bets", requireUser, async (req, res) => {
  const { areaHeb, betDate, predictedTime, amount, paymentMethodId } =
    req.body || {};

  if (!areaHeb || !betDate || !predictedTime || !amount || !paymentMethodId) {
    return res.status(400).json({
      error:
        "areaHeb, betDate, predictedTime, amount, paymentMethodId are required",
    });
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(betDate))) {
    return res.status(400).json({ error: "betDate must be YYYY-MM-DD" });
  }

  if (!/^\d{2}:\d{2}$/.test(String(predictedTime))) {
    return res.status(400).json({ error: "predictedTime must be HH:mm" });
  }

  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    return res.status(400).json({ error: "amount must be > 0" });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const pmCheck = await client.query(
      `
      SELECT id
      FROM payment_methods
      WHERE id = $1 AND user_id = $2
      `,
      [paymentMethodId, req.userId],
    );

    if (!pmCheck.rows[0]) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Invalid payment method" });
    }

    const userRes = await client.query(
      `SELECT balance FROM users WHERE id = $1 FOR UPDATE`,
      [req.userId],
    );

    if (!userRes.rows[0]) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "User not found" });
    }

    const balance = Number(userRes.rows[0].balance);
    if (balance < numericAmount) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Insufficient balance" });
    }

    const insertBet = await client.query(
      `
      INSERT INTO bets (
        user_id,
        area_heb,
        bet_date,
        predicted_time,
        amount,
        payment_method_id,
        status
      )
      VALUES ($1, $2, $3, $4, $5, $6, 'open')
      RETURNING id
      `,
      [
        req.userId,
        normalizeAreaName(areaHeb),
        betDate,
        predictedTime,
        numericAmount,
        paymentMethodId,
      ],
    );

    await client.query(
      `
      UPDATE users
      SET balance = balance - $1
      WHERE id = $2
      `,
      [numericAmount, req.userId],
    );

    await client.query(
      `
      INSERT INTO wallet_ledger (user_id, kind, amount, ref_type, ref_id, note)
      VALUES ($1, 'bet_stake', $2, 'bet', $3, $4)
      `,
      [
        req.userId,
        -numericAmount,
        String(insertBet.rows[0].id),
        `Stake for ${areaHeb} on ${betDate} at ${predictedTime}`,
      ],
    );

    await client.query("COMMIT");

    res.json({
      ok: true,
      betId: insertBet.rows[0].id,
    });
  } catch (e) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: e?.message ?? "server error" });
  } finally {
    client.release();
  }
});

app.get("/api/bets", requireUser, async (req, res) => {
  const result = await pool.query(
    `
    SELECT
      id,
      area_heb,
      TO_CHAR(bet_date, 'YYYY-MM-DD') AS bet_date,
      predicted_time,
      amount,
      status,
      payout_amount,
      placed_at,
      settled_alert_time
    FROM bets
    WHERE user_id = $1
    ORDER BY placed_at DESC
    `,
    [req.userId],
  );

  res.json(result.rows);
});

app.listen(HTTP_PORT, () => {
  console.log(`HTTP API running on http://localhost:${HTTP_PORT}`);
});

loop();
expiryLoop();
