const {
  getAlertDateParts,
  parsePredictedTimestampLocal,
  toDateOnlyString,
} = require("../utils/time");
const { round2, REGION_PAYOUT_MULTIPLIER } = require("../utils/money");
const { extractAlerts } = require("../oref/oref.parser");

function createSettlementService(deps) {
  const {
    pool,
    broadcast,
    getOrCreateUserWallet,
    insertLedger,
  } = deps;

  async function settleAreaAlert({ areaHeb, alertTime }) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const alertTs = new Date(alertTime);
      const { dateStr: alertDate } = getAlertDateParts(alertTs);

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
        return { ok: true, areaHeb, alertTime, note: "already settled" };
      }

      const alertId = insertedAlert.rows[0].id;
      const betsRes = await client.query(
        `
        SELECT
          id, user_id, area_heb, bet_date, predicted_time, amount,
          status, allow_minute_proximity, is_region
        FROM bets
        WHERE area_heb = $1 AND bet_date = $2 AND status = 'open'
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
        return { ...bet, predictedTs, diffMs };
      });
      scored.sort((a, b) => a.diffMs - b.diffMs);

      const alertMinute =
        alertTs.getHours() * 60 + alertTs.getMinutes();
      const exactWinners = scored.filter((b) => {
        const m =
          b.predictedTs.getHours() * 60 + b.predictedTs.getMinutes();
        return m === alertMinute;
      });

      let nearWinners = [];
      if (exactWinners.length > 0) {
        const nonExact = scored.filter(
          (b) =>
            !exactWinners.some((w) => w.id === b.id) &&
            b.allow_minute_proximity,
        );
        if (nonExact.length > 0) {
          const bestNearMinuteDiff = Math.min(
            ...nonExact.map((b) =>
              Math.abs(
                alertMinute -
                  (b.predictedTs.getHours() * 60 +
                    b.predictedTs.getMinutes()),
              ),
            ),
          );
          nearWinners = nonExact.filter(
            (b) =>
              Math.abs(
                alertMinute -
                  (b.predictedTs.getHours() * 60 +
                    b.predictedTs.getMinutes()),
              ) === bestNearMinuteDiff &&
              bestNearMinuteDiff <= 10,
          );
        }
      } else {
        const proximityCandidates = scored.filter(
          (b) => b.allow_minute_proximity,
        );
        if (proximityCandidates.length > 0) {
          const bestNearMinuteDiff = Math.min(
            ...proximityCandidates.map((b) =>
              Math.abs(
                alertMinute -
                  (b.predictedTs.getHours() * 60 +
                    b.predictedTs.getMinutes()),
              ),
            ),
          );
          if (bestNearMinuteDiff <= 10) {
            nearWinners = proximityCandidates.filter(
              (b) =>
                Math.abs(
                  alertMinute -
                    (b.predictedTs.getHours() * 60 +
                      b.predictedTs.getMinutes()),
                ) === bestNearMinuteDiff,
            );
          }
        }
      }

      const winners = [...exactWinners, ...nearWinners];
      const totalPot = round2(
        scored.reduce((sum, bet) => sum + Number(bet.amount), 0),
      );
      const singleWinnerGetsFullPot =
        scored.length === 1 && winners.length === 1;
      const platformFee = singleWinnerGetsFullPot
        ? 0
        : round2(totalPot * 0.1);
      const distributable = round2(totalPot - platformFee);

      const exactPoolShare = 0.7;
      let exactPool = 0,
        nearPool = 0;
      if (exactWinners.length > 0 && nearWinners.length > 0) {
        exactPool = round2(distributable * exactPoolShare);
        nearPool = round2(distributable - exactPool);
      } else if (exactWinners.length > 0) {
        exactPool = distributable;
      } else {
        nearPool = distributable;
      }
      const exactPayoutEach =
        exactWinners.length > 0
          ? round2(exactPool / exactWinners.length)
          : 0;
      const nearPayoutEach =
        nearWinners.length > 0 ? round2(nearPool / nearWinners.length) : 0;

      const winnerIdsExact = exactWinners.map((w) => w.id);
      const winnerIdsNear = nearWinners.map((w) => w.id);
      const winnerIds = winners.map((w) => w.id);
      const allBetIds = scored.map((b) => b.id);

      const winnerPayouts = winners.map((w) => ({
        id: w.id,
        payout: round2(
          (winnerIdsExact.includes(w.id) ? exactPayoutEach : nearPayoutEach) *
            (w.is_region ? REGION_PAYOUT_MULTIPLIER : 1),
        ),
      }));
      const winnerPayoutMap = new Map(
        winnerPayouts.map((wp) => [wp.id, wp.payout]),
      );

      await client.query(
        `
        UPDATE bets
        SET status = CASE WHEN id = ANY($1) THEN 'won' ELSE 'lost' END,
            settled_alert_time = $2,
            payout_amount = 0
        WHERE id = ANY($3)
        `,
        [winnerIds, alertTs.toISOString(), allBetIds],
      );
      for (const { id, payout } of winnerPayouts) {
        await client.query(
          `UPDATE bets SET payout_amount = $1 WHERE id = $2`,
          [payout, id],
        );
      }

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

      async function applyLoserWalletEffects() {
        const losers = scored.filter((b) => !winnerIds.includes(b.id));
        for (const bet of losers) {
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
            note: `Lost stake for ${areaHeb} on ${toDateOnlyString(
              bet.bet_date,
            )} at ${bet.predicted_time}`,
          });
        }
      }

      async function applyWinnerWalletEffects() {
        for (const winner of winners) {
          const wallet = await getWalletForUser(winner.user_id);
          wallet.reserved_balance = round2(
            Number(wallet.reserved_balance) - Number(winner.amount),
          );
          const credit = winnerPayoutMap.get(winner.id) ?? 0;
          if (credit > 0) {
            wallet.available_balance = round2(
              Number(wallet.available_balance) + credit,
            );
            await insertLedger(client, {
              userId: winner.user_id,
              kind: "win_payout",
              amount: credit,
              bucket: "available",
              ref_type: "alert",
              ref_id: String(alertId),
              note: `Payout for area ${areaHeb} alert at ${alertTs.toISOString()}`,
            });
          }
        }
      }

      await applyLoserWalletEffects();
      await applyWinnerWalletEffects();

      for (const wallet of walletCache.values()) {
        await client.query(
          `
          UPDATE user_wallets
          SET available_balance = $1, reserved_balance = $2, updated_at = now()
          WHERE user_id = $3
          `,
          [wallet.available_balance, wallet.reserved_balance, wallet.user_id],
        );
      }

      if (platformFee > 0) {
        await client.query(
          `
          INSERT INTO platform_revenue (alert_id, amount, area_heb, alert_time)
          VALUES ($1, $2, $3, $4)
          `,
          [alertId, platformFee, areaHeb, alertTs.toISOString()],
        );
      }

      await client.query("COMMIT");

      const result = {
        ok: true,
        areaHeb,
        alertTime: alertTs.toISOString(),
        totalPot,
        platformFee,
        distributable,
        payoutEach: exactPayoutEach || nearPayoutEach,
        exactPayoutEach,
        nearPayoutEach,
        winners: winners.map((w) => ({
          betId: w.id,
          userId: w.user_id,
          predictedTime: w.predicted_time,
        })),
        exactWinnerBetIds: winnerIdsExact,
        nearWinnerBetIds: winnerIdsNear,
        affectedBetIds: allBetIds,
      };

      broadcast({
        type: "bet_settlement",
        ts: Date.now(),
        payload: {
          areaHeb,
          alertTime: result.alertTime,
          totalPot,
          platformFee,
          exactPayoutEach,
          nearPayoutEach,
          winners: result.winners,
          affectedBetIds: allBetIds,
          affectedAreaKey: areaHeb,
        },
      });

      for (const wallet of walletCache.values()) {
        broadcast({
          type: "wallet_updated",
          ts: Date.now(),
          payload: {
            userId: wallet.user_id,
            availableBalance: wallet.available_balance,
            reservedBalance: wallet.reserved_balance,
            reason: "win_or_loss_settlement",
          },
        });
      }

      return result;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  async function processAlertPayload(json) {
    const alerts = extractAlerts(json);
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

  return { settleAreaAlert, processAlertPayload };
}

module.exports = { createSettlementService };
