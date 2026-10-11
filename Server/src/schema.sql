CREATE TABLE alerts (
  id BIGSERIAL PRIMARY KEY,
  area_heb TEXT NOT NULL,
  alert_time TIMESTAMPTZ NOT NULL,
  alert_date DATE NOT NULL,
  raw_area_key TEXT,
  UNIQUE(area_heb, alert_time)
);
