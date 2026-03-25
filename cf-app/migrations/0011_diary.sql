CREATE TABLE IF NOT EXISTS five_year_diary (
  date TEXT NOT NULL,
  year INTEGER NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  wish_content TEXT NOT NULL DEFAULT '',
  mood TEXT NOT NULL DEFAULT '',
  weather TEXT NOT NULL DEFAULT '',
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (date, year)
);
