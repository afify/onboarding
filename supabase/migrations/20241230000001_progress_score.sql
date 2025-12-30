-- Add score field to progress table for scorable categories

-- Score is 1-10, nullable (only applicable for categories with has_score = true)
ALTER TABLE progress ADD COLUMN IF NOT EXISTS score SMALLINT CHECK (score IS NULL OR (score >= 1 AND score <= 10));

-- Add has_score flag to task_categories
ALTER TABLE task_categories ADD COLUMN IF NOT EXISTS has_score BOOLEAN DEFAULT false;

-- Disable user triggers only (not system triggers)
ALTER TABLE task_categories DISABLE TRIGGER USER;

-- Set has_score = true for exercise and project categories
UPDATE task_categories SET has_score = true WHERE name IN ('exercise', 'project');

-- Re-enable user triggers
ALTER TABLE task_categories ENABLE TRIGGER USER;

-- Add comment for documentation
COMMENT ON COLUMN progress.score IS 'Score out of 10, only for categories with has_score = true';
COMMENT ON COLUMN task_categories.has_score IS 'Whether tasks in this category can be scored';
