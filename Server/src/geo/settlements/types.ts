/**
 * Settlement resolution types.
 * SettlementGeoMatch is the domain shape returned for each resolved settlement.
 */

import type { SettlementGeoMatch } from "../../domain/alerts/types";

export type { SettlementGeoMatch };

export interface ResolveSettlementsResult {
  matched: SettlementGeoMatch[];
  unresolved: string[];
}
