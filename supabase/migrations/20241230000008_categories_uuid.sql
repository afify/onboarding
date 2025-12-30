DROP TRIGGER IF EXISTS task_categories_activity_trigger ON task_categories;

ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_category_id_fkey;

ALTER TABLE task_categories ADD COLUMN new_id UUID DEFAULT gen_random_uuid();

ALTER TABLE tasks ADD COLUMN new_category_id UUID;

UPDATE tasks t SET new_category_id = c.new_id FROM task_categories c WHERE t.category_id = c.id;

ALTER TABLE tasks DROP COLUMN category_id;
ALTER TABLE tasks RENAME COLUMN new_category_id TO category_id;

ALTER TABLE task_categories DROP COLUMN id;
ALTER TABLE task_categories RENAME COLUMN new_id TO id;
ALTER TABLE task_categories ADD PRIMARY KEY (id);

ALTER TABLE tasks ADD CONSTRAINT tasks_category_id_fkey FOREIGN KEY (category_id) REFERENCES task_categories(id) ON DELETE SET NULL;

CREATE TRIGGER task_categories_activity_trigger
  AFTER INSERT OR UPDATE OR DELETE ON task_categories
  FOR EACH ROW EXECUTE FUNCTION log_activity();
