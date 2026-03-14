const crypto = require("crypto");
const { round2 } = require("../utils/money");

function mountWalletRoutes(app, deps) {
  const {
    pool,
    requireUser,
    getOrCreateUserWallet,
    buildWalletResponseRow,
    insertLedger,
    broadcast,
  } = deps;

  app.get("/api/me", requireUser, async (req, res) => {
    const result = await pool.query(
      `
      SELECT u.id, u.email, w.available_balance, w.reserved_balance
      FROM users u
      JOIN user_wallets w ON w.user_id = u.id
      WHERE u.id = $1
      `,
      [req.userId],
    );
    if (!result.rows[0]) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json(buildWalletResponseRow(result.rows[0]));
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
      return res.status(400).json({
        error: "paymentMethodId is required",
      });
    }
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const pmCheck = await client.query(
        `SELECT id FROM payment_methods WHERE id = $1 AND user_id = $2`,
        [paymentMethodId, req.userId],
      );
      if (!pmCheck.rows[0]) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "Invalid payment method" });
      }
      const wallet = await getOrCreateUserWallet(client, req.userId, {
        forUpdate: true,
      });
      const newAvailable = round2(
        Number(wallet.available_balance) + numericAmount,
      );
      await client.query(
        `
        UPDATE user_wallets
        SET available_balance = $1, updated_at = now()
        WHERE user_id = $2
        `,
        [newAvailable, req.userId],
      );
      await insertLedger(client, {
        userId: req.userId,
        kind: "deposit",
        amount: numericAmount,
        bucket: "available",
        ref_type: "payment_method",
        ref_id: String(paymentMethodId),
        note: `Manual deposit of ${numericAmount} via payment method ${paymentMethodId}`,
      });
      await client.query("COMMIT");
      const updated = await pool.query(
        `
        SELECT u.id, u.email, w.available_balance, w.reserved_balance
        FROM users u
        JOIN user_wallets w ON w.user_id = u.id
        WHERE u.id = $1
        `,
        [req.userId],
      );
      const userWithWallet = buildWalletResponseRow(updated.rows[0]);
      broadcast({
        type: "wallet_updated",
        ts: Date.now(),
        payload: {
          userId: userWithWallet.id,
          availableBalance: userWithWallet.wallet.availableBalance,
          reservedBalance: userWithWallet.wallet.reservedBalance,
          reason: "deposit",
        },
      });
      res.json({ ok: true, user: userWithWallet });
    } catch (e) {
      await client.query("ROLLBACK");
      res.status(500).json({ error: e?.message ?? "server error" });
    } finally {
      client.release();
    }
  });
}

module.exports = { mountWalletRoutes };
