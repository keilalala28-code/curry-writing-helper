-- Week goals table
CREATE TABLE IF NOT EXISTS week_goals (
  id TEXT PRIMARY KEY,
  year INTEGER NOT NULL,
  week INTEGER NOT NULL,
  title TEXT NOT NULL,
  done INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_week_goals_year_week ON week_goals(year, week);
