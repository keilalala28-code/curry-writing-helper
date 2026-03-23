CREATE TABLE IF NOT EXISTS routine_preset (
  id TEXT PRIMARY KEY,
  sort_order INTEGER NOT NULL DEFAULT 0,
  time_start TEXT NOT NULL,
  time_end TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'morning',
  reminder_minutes INTEGER NOT NULL DEFAULT 0,
  enabled INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS routine_daily_log (
  date TEXT NOT NULL,
  item_id TEXT NOT NULL,
  completed INTEGER NOT NULL DEFAULT 0,
  completed_at INTEGER,
  PRIMARY KEY (date, item_id)
);

CREATE TABLE IF NOT EXISTS routine_notes (
  date TEXT PRIMARY KEY,
  notes TEXT NOT NULL DEFAULT ''
);
