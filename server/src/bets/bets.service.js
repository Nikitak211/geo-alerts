const { normalizeAreaName } = require("../utils/normalize");
const { round2 } = require("../utils/money");
const { parsePredictedTimestampLocal } = require("../utils/time");

function createBetsService(deps) {
  const { pool, getOrCreateUserWallet, insertLedger } = deps;

  async function placeBet(userId, params) {
    const {
      areaHeb,
      betDate,
      predictedTime,
      amount,
      paymentMethodId,
      allowMinuteProximity = false,
      is_region = false,
    } = params;

    const predictedTs = parsePredictedTimestampLocal(betDate, predictedTime);
    if (predictedTs.getTime() <= Date.now()) {
      throw new Error("Cannot place a bet for a time in the past");
    }

    const numericAmount = Number(amount);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const pmCheck = await client.query(
        `SELECT id FROM payment_methods WHERE id = $1 AND user_id = $2`,
        [paymentMethodId, userId],
      );
      if (!pmCheck.rows[0]) {
        await client.query("ROLLBACK");
        throw new Error("Invalid payment method");
      }

      const wallet = await getOrCreateUserWallet(client, userId, {
        forUpdate: true,
      });
      const available = Number(wallet.available_balance);
      if (available < numericAmount) {
        await client.query("ROLLBACK");
        throw new Error("Insufficient balance");
      }

      const insertBet = await client.query(
        `
        INSERT INTO bets (
          user_id, area_heb, bet_date, predicted_time, amount,
          payment_method_id, status, allow_minute_proximity, is_region
        )
        VALUES ($1, $2, $3, $4, $5, $6, 'open', $7, $8)
        RETURNING id
        `,
        [
          userId,
          normalizeAreaName(areaHeb),
          betDate,
          predictedTime,
          numericAmount,
          paymentMethodId,
          !!allowMinuteProximity,
          !!is_region,
        ],
      );
      const betId = insertBet.rows[0].id;
      const newAvailable = round2(available - numericAmount);
      const newReserved = round2(
        Number(wallet.reserved_balance) + numericAmount,
      );

      await client.query(
        `
        UPDATE user_wallets
        SET available_balance = $1, reserved_balance = $2, updated_at = now()
        WHERE user_id = $3
        `,
        [newAvailable, newReserved, userId],
      );
      await insertLedger(client, {
        userId,
        kind: "bet_reserve",
        amount: -numericAmount,
        bucket: "available",
        ref_type: "bet",
        ref_id: String(betId),
        note: `Move stake from available to reserved for ${areaHeb} on ${betDate} at ${predictedTime}`,
      });
      await insertLedger(client, {
        userId,
        kind: "bet_reserve",
        amount: numericAmount,
        bucket: "reserved",
        ref_type: "bet",
        ref_id: String(betId),
        note: `Stake reserved for ${areaHeb} on ${betDate} at ${predictedTime}`,
      });

      await client.query("COMMIT");
      return {
        betId,
        newAvailable,
        newReserved,
      };
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }

  async function getBets(userId) {
    const result = await pool.query(
      `
      SELECT id, area_heb, TO_CHAR(bet_date, 'YYYY-MM-DD') AS bet_date,
             predicted_time, amount, status, payout_amount, placed_at,
             settled_alert_time, allow_minute_proximity, is_region
      FROM bets
      WHERE user_id = $1
      ORDER BY placed_at DESC
      `,
      [userId],
    );
    return result.rows;
  }

  async function getBetsSummary(userId) {
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
      [userId],
    );
    return (
      result.rows[0] || {
        open_count: 0,
        won_count: 0,
        lost_count: 0,
        void_count: 0,
      }
    );
  }

  return { placeBet, getBets, getBetsSummary };
}

module.exports = { createBetsService };
