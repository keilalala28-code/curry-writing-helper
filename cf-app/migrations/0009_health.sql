CREATE TABLE IF NOT EXISTS health_weight (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  weight REAL NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_health_weight_date ON health_weight(date);

CREATE TABLE IF NOT EXISTS health_measurements (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  chest REAL,
  waist REAL,
  hips REAL,
  thigh REAL,
  arm REAL,
  calf REAL,
  wrist REAL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_health_measurements_date ON health_measurements(date);

CREATE TABLE IF NOT EXISTS health_exercise (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  type TEXT NOT NULL,
  duration INTEGER,
  calories INTEGER,
  note TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS health_goals (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
