/**
 * Settlement resolution: OREF names → coordinates and polygon ids.
 */

export { normalizeSettlementName, getLookupCandidates } from "./normalizeSettlementName";
export { resolveSettlements } from "./settlementResolver";
export type { SettlementResolverOptions } from "./settlementResolver";
export type { SettlementGeoMatch, ResolveSettlementsResult } from "./types";
