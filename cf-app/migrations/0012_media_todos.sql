-- Add todos, start_date, end_date to media_contents
ALTER TABLE media_contents ADD COLUMN todos TEXT NOT NULL DEFAULT '[]';
ALTER TABLE media_contents ADD COLUMN start_date TEXT NOT NULL DEFAULT '';
ALTER TABLE media_contents ADD COLUMN end_date TEXT NOT NULL DEFAULT '';
