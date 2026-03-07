export type { PlaceData, CityRow } from "./place";
export type { AlertPayload, HighlightStore } from "./alert";
export type { AlertPayload, HighlightStore } from "./alert";

export type OrefAlert = {
  id: string;
  cat: string;
  title: string;
  data: string[]; // location names in Hebrew
  desc: string;
};

export type GeoBox = {
  place: string;
  bbox: [number, number, number, number]; // [south, north, west, east]
  center: { lat: number; lon: number };
  displayName?: string;
  title: string;
};

export type SelectedArea = {
  areaHeb: string;
  entityId: string;
};

export type BetFormValues = {
  date: string; // YYYY-MM-DD
  predictedTime: string; // "HH:MM"
  amount: number;
  allowMinuteProximity?: boolean;
  /** Selected area (Hebrew name from map or dropdown). */
  areaHeb?: string;
  /** @deprecated Use areaHeb. Kept for compatibility. */
  name?: string;
};
export type Wallet = {
  availableBalance: number;
  reservedBalance: number;
  totalBalance: number;
};

export type User = {
  id: string;
  email: string;
  wallet: Wallet;
};

export type PaymentMethod = {
  id: string;
  label: string;
};
export type BetStatus = "open" | "won" | "lost" | "void";

export type Bet = {
  id: string | number;
  area_heb: string;
  bet_date: string;
  predicted_time: string;
  amount: number;
  status: BetStatus;
  payout_amount?: number;
  placed_at?: string | null;
  settled_alert_time?: string | null;
  allow_minute_proximity?: boolean;
  is_region?: boolean;
};
