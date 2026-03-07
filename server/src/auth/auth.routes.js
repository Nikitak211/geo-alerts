const crypto = require("crypto");

function mountAuthRoutes(app, deps) {
  const {
    pool,
    hashPassword,
    normalizeEmail,
    getOrCreateUserWallet,
    buildWalletResponseRow,
  } = deps;

  app.post("/api/register", async (req, res) => {
    const { email, password } = req.body || {};
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) {
      return res.status(400).json({ error: "email is required" });
    }
    if (!password || String(password).length < 4) {
      return res.status(400).json({
        error: "password must be at least 4 chars",
      });
    }
    const existing = await pool.query(
      `SELECT id FROM users WHERE email = $1`,
      [normalizedEmail],
    );
    if (existing.rows[0]) {
      return res.status(400).json({ error: "User already exists" });
    }
    const id = crypto.randomUUID();
    const passwordHash = hashPassword(password);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `INSERT INTO users (id, email, password_hash) VALUES ($1, $2, $3)`,
        [id, normalizedEmail, passwordHash],
      );
      await client.query(
        `INSERT INTO user_wallets (user_id, available_balance, reserved_balance) VALUES ($1, 0, 0)`,
        [id],
      );
      const result = await client.query(
        `
        SELECT u.id, u.email, w.available_balance, w.reserved_balance
        FROM users u
        JOIN user_wallets w ON w.user_id = u.id
        WHERE u.id = $1
        `,
        [id],
      );
      await client.query("COMMIT");
      res.json({
        ok: true,
        user: buildWalletResponseRow(result.rows[0]),
      });
    } catch (e) {
      await client.query("ROLLBACK");
      res.status(500).json({ error: e?.message ?? "server error" });
    } finally {
      client.release();
    }
  });

  app.post("/api/login", async (req, res) => {
    const { email, password } = req.body || {};
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail || !password) {
      return res
        .status(400)
        .json({ error: "email and password are required" });
    }
    const passwordHash = hashPassword(password);
    const result = await pool.query(
      `
      SELECT u.id, u.email, w.available_balance, w.reserved_balance
      FROM users u
      JOIN user_wallets w ON w.user_id = u.id
      WHERE u.email = $1 AND u.password_hash = $2
      `,
      [normalizedEmail, passwordHash],
    );
    if (!result.rows[0]) {
      return res.status(401).json({ error: "Invalid email or password" });
    }
    res.json({
      ok: true,
      user: buildWalletResponseRow(result.rows[0]),
    });
  });

  app.post("/api/logout", async (_req, res) => {
    res.json({ ok: true });
  });
}

module.exports = { mountAuthRoutes };
