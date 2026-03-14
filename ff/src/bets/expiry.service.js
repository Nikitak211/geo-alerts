const {
  parsePredictedTimestampLocal,
  toDateOnlyString,
} = require("../utils/time");
const { round2 } = require("../utils/money");

const BET_EXPIRY_GRACE_MS = 60 * 1000; // 1 minute grace for exact-only bets
const PROXIMITY_EXPIRY_GRACE_MS = 10 * 60 * 1000; // 10 min when allow_minute_proximity

function createExpiryService(deps) {
  const { pool, broadcast, getOrCreateUserWallet, insertLedger } = deps;

  async function expireMissedBets() {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const openBetsRes = await client.query(
        `
        SELECT id, user_id, area_heb, bet_date, predicted_time, amount,
               status, allow_minute_proximity
        FROM bets
        WHERE status = 'open'
        FOR UPDATE
        `,
      );

      const now = Date.now();
      const expiredBetIds = [];
      const expiredBets = [];

      for (const bet of openBetsRes.rows) {
        const betDate = toDateOnlyString(bet.bet_date);
        const predictedTs = parsePredictedTimestampLocal(
          betDate,
          bet.predicted_time,
        );
        const graceMs = bet.allow_minute_proximity
          ? PROXIMITY_EXPIRY_GRACE_MS
          : BET_EXPIRY_GRACE_MS;
        const expiryTs = predictedTs.getTime() + graceMs;
        if (now <= expiryTs) continue;

        const fromTs = new Date(predictedTs.getTime() - graceMs);
        const toTs = new Date(predictedTs.getTime() + graceMs);
        const alertCheck = await client.query(
          `
          SELECT id FROM alerts
          WHERE area_heb = $1 AND alert_date = $2
            AND alert_time BETWEEN $3 AND $4
          LIMIT 1
          `,
          [bet.area_heb, betDate, fromTs.toISOString(), toTs.toISOString()],
        );
        if (alertCheck.rows[0]) continue;

        expiredBetIds.push(bet.id);
        expiredBets.push(bet);
      }

      if (expiredBetIds.length > 0) {
        await client.query(
          `
          UPDATE bets SET status = 'lost', payout_amount = 0
          WHERE id = ANY($1) AND status = 'open'
          `,
          [expiredBetIds],
        );

        const walletCache = new Map();
        async function getWalletForUser(userId) {
          if (walletCache.has(userId)) return walletCache.get(userId);
          const row = await getOrCreateUserWallet(client, userId, {
            forUpdate: true,
          });
          const copy = {
            user_id: row.user_id,
            available_balance: Number(row.available_balance),
            reserved_balance: Number(row.reserved_balance),
          };
          walletCache.set(userId, copy);
          return copy;
        }

        for (const bet of expiredBets) {
          const wallet = await getWalletForUser(bet.user_id);
          wallet.reserved_balance = round2(
            Number(wallet.reserved_balance) - Number(bet.amount),
          );
          await insertLedger(client, {
            userId: bet.user_id,
            kind: "bet_loss",
            amount: -Number(bet.amount),
            bucket: "reserved",
            ref_type: "bet",
            ref_id: String(bet.id),
            note: `Lost stake (expired) for ${bet.area_heb} on ${toDateOnlyString(
              bet.bet_date,
            )} at ${bet.predicted_time}`,
          });
        }

        for (const wallet of walletCache.values()) {
          await client.query(
            `
            UPDATE user_wallets
            SET available_balance = $1, reserved_balance = $2, updated_at = now()
            WHERE user_id = $3
            `,
            [
              wallet.available_balance,
              wallet.reserved_balance,
              wallet.user_id,
            ],
          );
        }
      }

      await client.query("COMMIT");

      if (expiredBetIds.length > 0) {
        broadcast({
          type: "bets_expired",
          ts: Date.now(),
          payload: { count: expiredBetIds.length, betIds: expiredBetIds },
        });
        console.log("Expired missed bets:", expiredBetIds);
      }
    } catch (e) {
      await client.query("ROLLBACK");
      console.error("expireMissedBets error:", e?.message ?? e);
    } finally {
      client.release();
    }
  }

  return { expireMissedBets };
}

module.exports = { createExpiryService };
