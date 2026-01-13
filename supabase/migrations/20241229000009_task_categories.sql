CREATE OR REPLACE FUNCTION log_activity()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO activity_log (mentor_id, action, entity_type, entity_id, details)
  VALUES (
    auth.uid(),
    TG_OP,
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    CASE
      WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD)
      ELSE to_jsonb(NEW)
    END
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TABLE IF NOT EXISTS task_categories (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  label TEXT NOT NULL,
  color TEXT NOT NULL,
  icon TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE task_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All can view task_categories" ON task_categories
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin can manage task_categories" ON task_categories
  FOR ALL USING (
    EXISTS (SELECT 1 FROM mentors WHERE id = auth.uid() AND role = 'admin')
  );

INSERT INTO task_categories (name, label, color, icon) VALUES
  ('learning', 'Learning', '#00d4ff', 'book'),
  ('exercise', 'Exercise', '#7c3aed', 'code'),
  ('project', 'Project', '#10b981', 'folder'),
  ('admin', 'Admin Task', '#f59e0b', 'clipboard')
ON CONFLICT (name) DO NOTHING;

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS category_id INT REFERENCES task_categories(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'category') THEN
    UPDATE tasks SET category_id = (SELECT id FROM task_categories WHERE name = tasks.category) WHERE category IS NOT NULL;
    ALTER TABLE tasks DROP COLUMN category;
  END IF;
END $$;

CREATE TRIGGER task_categories_activity_trigger
  AFTER INSERT OR UPDATE OR DELETE ON task_categories
  FOR EACH ROW EXECUTE FUNCTION log_activity();

ALTER PUBLICATION supabase_realtime ADD TABLE task_categories;
