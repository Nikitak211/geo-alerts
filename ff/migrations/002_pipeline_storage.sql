-- Pipeline persistence for replay/debugging.
-- Run after 001 if present: psql -f migrations/002_pipeline_storage.sql

CREATE TABLE IF NOT EXISTS pipeline_alerts (
  id TEXT PRIMARY KEY,
  raw_payload JSONB NOT NULL,
  normalized_alert JSONB NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  settlement_matches JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS inference_results (
  id BIGSERIAL PRIMARY KEY,
  alert_id TEXT NOT NULL,
  cluster JSONB NOT NULL,
  corridor JSONB NOT NULL,
  ranked_candidates JSONB NOT NULL,
  algorithm_version TEXT NOT NULL,
  summary JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS inference_results_alert_id_idx ON inference_results(alert_id);

CREATE TABLE IF NOT EXISTS screenshot_metadata (
  id BIGSERIAL PRIMARY KEY,
  alert_id TEXT NOT NULL,
  path TEXT NOT NULL,
  url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  width INT,
  height INT,
  theme TEXT,
  algorithm_version TEXT
);

CREATE INDEX IF NOT EXISTS screenshot_metadata_alert_id_idx ON screenshot_metadata(alert_id);
