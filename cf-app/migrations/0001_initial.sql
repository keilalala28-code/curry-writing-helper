CREATE TABLE IF NOT EXISTS articles (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '',
  category TEXT DEFAULT '',
  word_count INTEGER DEFAULT 0,
  source TEXT DEFAULT '',
  import_date TEXT DEFAULT '',
  content TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS tags (
  name TEXT PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS article_tags (
  article_id TEXT NOT NULL,
  tag TEXT NOT NULL,
  PRIMARY KEY (article_id, tag)
);

CREATE TABLE IF NOT EXISTS article_hooks (
  article_id TEXT NOT NULL,
  hook TEXT NOT NULL,
  PRIMARY KEY (article_id, hook)
);

CREATE INDEX IF NOT EXISTS idx_articles_category ON articles(category);
CREATE INDEX IF NOT EXISTS idx_articles_source ON articles(source);
CREATE INDEX IF NOT EXISTS idx_article_tags_article ON article_tags(article_id);
CREATE INDEX IF NOT EXISTS idx_article_hooks_article ON article_hooks(article_id);
