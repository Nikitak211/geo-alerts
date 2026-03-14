function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

/** Payout multiplier for bets on region areas (e.g. "גולן") vs settlements. */
const REGION_PAYOUT_MULTIPLIER = 0.5;

module.exports = {
  round2,
  REGION_PAYOUT_MULTIPLIER,
};
