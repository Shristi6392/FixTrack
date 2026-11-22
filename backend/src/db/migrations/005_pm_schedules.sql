CREATE TABLE pm_schedules (
  id          SERIAL PRIMARY KEY,
  asset_id    INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  frequency   TEXT NOT NULL CHECK (frequency IN ('daily','weekly','monthly')),
  next_run_at TIMESTAMPTZ NOT NULL,
  active      BOOLEAN NOT NULL DEFAULT true,
  created_by  INTEGER NOT NULL REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_pm_due ON pm_schedules(next_run_at) WHERE active;
