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
};
export type User = {
  id: string;
  email: string;
  balance: number;
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
};
