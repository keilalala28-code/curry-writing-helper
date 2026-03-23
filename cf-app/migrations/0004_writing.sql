-- Writing goals (one row per month)
CREATE TABLE IF NOT EXISTS writing_goals (
  year         INTEGER NOT NULL,
  month        INTEGER NOT NULL,
  monthly_target INTEGER NOT NULL DEFAULT 100000,
  daily_target   INTEGER NOT NULL DEFAULT 3000,
  PRIMARY KEY (year, month)
);

-- Daily writing records
CREATE TABLE IF NOT EXISTS writing_records (
  date         TEXT PRIMARY KEY,  -- YYYY-MM-DD
  actual_words INTEGER NOT NULL DEFAULT 0,
  note         TEXT NOT NULL DEFAULT ''
);
