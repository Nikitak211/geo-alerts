const { parsePredictedTimestampLocal } = require("../utils/time");

function mountBetsRoutes(app, deps) {
  const {
    requireUser,
    betsService,
    broadcast,
  } = deps;

  app.get("/api/bets/summary", requireUser, async (req, res) => {
    const summary = await betsService.getBetsSummary(req.userId);
    res.json(summary);
  });

  app.post("/api/bets", requireUser, async (req, res) => {
    const {
      areaHeb,
      betDate,
      predictedTime,
      amount,
      paymentMethodId,
      allowMinuteProximity = false,
      is_region = false,
    } = req.body || {};

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

    const predictedTs = parsePredictedTimestampLocal(betDate, predictedTime);
    if (predictedTs.getTime() <= Date.now()) {
      return res.status(400).json({
        error: "Cannot place a bet for a time in the past",
      });
    }

    try {
      const result = await betsService.placeBet(req.userId, {
        areaHeb,
        betDate,
        predictedTime,
        amount: numericAmount,
        paymentMethodId,
        allowMinuteProximity: !!allowMinuteProximity,
        is_region: !!is_region,
      });
      broadcast({
        type: "wallet_updated",
        ts: Date.now(),
        payload: {
          userId: req.userId,
          availableBalance: result.newAvailable,
          reservedBalance: result.newReserved,
          reason: "bet_reserve",
        },
      });
      res.json({ ok: true, betId: result.betId });
    } catch (e) {
      res.status(400).json({ error: e?.message ?? "server error" });
    }
  });

  app.get("/api/bets", requireUser, async (req, res) => {
    const rows = await betsService.getBets(req.userId);
    res.json(rows);
  });
}

module.exports = { mountBetsRoutes };
