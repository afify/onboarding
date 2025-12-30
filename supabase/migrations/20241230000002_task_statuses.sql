CREATE TABLE IF NOT EXISTS task_statuses (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) UNIQUE NOT NULL,
  label VARCHAR(100) NOT NULL,
  color VARCHAR(20) NOT NULL DEFAULT '#6b7280',
  icon VARCHAR(50) DEFAULT 'circle',
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE task_statuses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read statuses"
  ON task_statuses FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage statuses"
  ON task_statuses FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

ALTER TABLE task_statuses DISABLE TRIGGER USER;

INSERT INTO task_statuses (name, label, color, icon, sort_order) VALUES
  ('pending', 'Pending', '#6b7280', 'clock', 1),
  ('in_progress', 'In Progress', '#f59e0b', 'play', 2),
  ('done', 'Done', '#10b981', 'check', 3),
  ('blocked', 'Blocked', '#ef4444', 'x', 4)
ON CONFLICT (name) DO NOTHING;

ALTER TABLE task_statuses ENABLE TRIGGER USER;

ALTER TABLE progress ADD COLUMN IF NOT EXISTS status_id INT REFERENCES task_statuses(id);

UPDATE progress p
SET status_id = s.id
FROM task_statuses s
WHERE p.status = s.name AND p.status_id IS NULL;

UPDATE progress
SET status_id = (SELECT id FROM task_statuses WHERE name = 'pending')
WHERE status_id IS NULL;

COMMENT ON TABLE task_statuses IS 'Task status definitions';
COMMENT ON COLUMN progress.status_id IS 'Reference to task_statuses table';
