-- Create task_statuses table

CREATE TABLE IF NOT EXISTS task_statuses (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) UNIQUE NOT NULL,
  label VARCHAR(100) NOT NULL,
  color VARCHAR(20) NOT NULL DEFAULT '#6b7280',
  icon VARCHAR(50) DEFAULT 'circle',
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE task_statuses ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read statuses
CREATE POLICY "Authenticated users can read statuses"
  ON task_statuses FOR SELECT
  TO authenticated
  USING (true);

-- Allow authenticated users to manage statuses
CREATE POLICY "Authenticated users can manage statuses"
  ON task_statuses FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Disable triggers temporarily for seeding
ALTER TABLE task_statuses DISABLE TRIGGER USER;

-- Seed default statuses
INSERT INTO task_statuses (name, label, color, icon, sort_order) VALUES
  ('pending', 'Pending', '#6b7280', 'clock', 1),
  ('in_progress', 'In Progress', '#f59e0b', 'play', 2),
  ('done', 'Done', '#10b981', 'check', 3),
  ('blocked', 'Blocked', '#ef4444', 'x', 4)
ON CONFLICT (name) DO NOTHING;

-- Re-enable triggers
ALTER TABLE task_statuses ENABLE TRIGGER USER;

-- Add status_id column to progress table
ALTER TABLE progress ADD COLUMN IF NOT EXISTS status_id INT REFERENCES task_statuses(id);

-- Migrate existing status data to status_id
UPDATE progress p
SET status_id = s.id
FROM task_statuses s
WHERE p.status = s.name AND p.status_id IS NULL;

-- Set default status_id for any remaining nulls
UPDATE progress
SET status_id = (SELECT id FROM task_statuses WHERE name = 'pending')
WHERE status_id IS NULL;

-- Add comments
COMMENT ON TABLE task_statuses IS 'Task status definitions';
COMMENT ON COLUMN progress.status_id IS 'Reference to task_statuses table';
