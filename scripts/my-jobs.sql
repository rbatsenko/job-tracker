CREATE TABLE IF NOT EXISTS my_jobs (
  id            TEXT PRIMARY KEY,
  origin_source TEXT,
  origin_id     TEXT,
  company       TEXT NOT NULL,
  title         TEXT NOT NULL,
  url           TEXT,
  location      TEXT,
  remote_scope  TEXT,
  salary_min    INTEGER,
  salary_max    INTEGER,
  currency      TEXT,
  salary_period TEXT,
  tags          TEXT NOT NULL DEFAULT '[]',
  description   TEXT,
  fit_score     INTEGER,
  fit_reasons   TEXT NOT NULL DEFAULT '[]',
  status        TEXT NOT NULL DEFAULT 'shortlist',
  starred       INTEGER NOT NULL DEFAULT 0,
  notes         TEXT,
  draft         TEXT,
  applied_at    TEXT,
  next_action   TEXT,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_my_jobs_status ON my_jobs(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_my_jobs_origin
  ON my_jobs(origin_source, origin_id) WHERE origin_source IS NOT NULL;
