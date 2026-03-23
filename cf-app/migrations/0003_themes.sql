CREATE TABLE IF NOT EXISTS generated_themes (
  theme TEXT PRIMARY KEY,
  keywords TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS theme_likes (
  theme TEXT PRIMARY KEY,
  liked_at TEXT NOT NULL DEFAULT (datetime('now'))
);
