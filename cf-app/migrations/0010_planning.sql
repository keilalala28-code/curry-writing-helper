CREATE TABLE IF NOT EXISTS month_goals (
  id TEXT PRIMARY KEY,
  year_month TEXT NOT NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'write',
  status TEXT NOT NULL DEFAULT 'todo',
  progress_note TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS year_goals (
  id TEXT PRIMARY KEY,
  year INTEGER NOT NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'write',
  progress INTEGER NOT NULL DEFAULT 0,
  quarter TEXT NOT NULL DEFAULT 'all',
  description TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS plan_notes (
  scope TEXT PRIMARY KEY,
  notes TEXT NOT NULL DEFAULT ''
);
