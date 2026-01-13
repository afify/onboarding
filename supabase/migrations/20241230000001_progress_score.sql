ALTER TABLE progress ADD COLUMN IF NOT EXISTS score SMALLINT CHECK (score IS NULL OR (score >= 1 AND score <= 10));

ALTER TABLE task_categories ADD COLUMN IF NOT EXISTS has_score BOOLEAN DEFAULT false;

ALTER TABLE task_categories DISABLE TRIGGER USER;

UPDATE task_categories SET has_score = true WHERE name IN ('exercise', 'project');

ALTER TABLE task_categories ENABLE TRIGGER USER;

COMMENT ON COLUMN progress.score IS 'Score out of 10, only for categories with has_score = true';
COMMENT ON COLUMN task_categories.has_score IS 'Whether tasks in this category can be scored';
