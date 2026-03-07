CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE user_wallets (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  available_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  reserved_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE payment_methods (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'manual',
  token TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE bets (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  area_heb TEXT NOT NULL,
  bet_date DATE NOT NULL,
  predicted_time TEXT NOT NULL, -- HH:mm
  amount NUMERIC(12,2) NOT NULL,
  payment_method_id TEXT NOT NULL REFERENCES payment_methods(id),
  status TEXT NOT NULL CHECK (status IN ('open', 'won', 'lost', 'void')),
  payout_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  placed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  settled_alert_time TIMESTAMPTZ,
  allow_minute_proximity BOOLEAN NOT NULL DEFAULT false,
  is_region BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX bets_lookup_idx
  ON bets (area_heb, bet_date, status);

CREATE TABLE alerts (
  id BIGSERIAL PRIMARY KEY,
  area_heb TEXT NOT NULL,
  alert_time TIMESTAMPTZ NOT NULL,
  alert_date DATE NOT NULL,
  raw_area_key TEXT,
  UNIQUE(area_heb, alert_time)
);

CREATE TABLE platform_revenue (
  id BIGSERIAL PRIMARY KEY,
  alert_id BIGINT NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL,
  area_heb TEXT NOT NULL,
  alert_time TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE wallet_ledger (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  bucket TEXT NOT NULL DEFAULT 'available',
  ref_type TEXT,
  ref_id TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- If bets table already exists without is_region, run:
-- ALTER TABLE bets ADD COLUMN is_region BOOLEAN NOT NULL DEFAULT false;