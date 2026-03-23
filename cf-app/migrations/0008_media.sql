CREATE TABLE IF NOT EXISTS media_platforms (
  platform TEXT PRIMARY KEY,
  followers INTEGER NOT NULL DEFAULT 0,
  month_change INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

INSERT OR IGNORE INTO media_platforms (platform, followers, month_change) VALUES ('xiaohongshu', 0, 0);
INSERT OR IGNORE INTO media_platforms (platform, followers, month_change) VALUES ('douyin', 0, 0);

CREATE TABLE IF NOT EXISTS media_contents (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'idea',
  platform TEXT NOT NULL DEFAULT '',
  publish_date TEXT NOT NULL DEFAULT '',
  publish_note TEXT NOT NULL DEFAULT '',
  likes INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS media_collabs (
  id TEXT PRIMARY KEY,
  brand TEXT NOT NULL,
  project TEXT NOT NULL,
  amount INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'new',
  collab_date TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
