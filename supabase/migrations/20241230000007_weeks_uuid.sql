DROP TRIGGER IF EXISTS weeks_activity_trigger ON weeks;

ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_week_id_fkey;

ALTER TABLE weeks ADD COLUMN new_id UUID DEFAULT gen_random_uuid();

ALTER TABLE tasks ADD COLUMN new_week_id UUID;

UPDATE tasks t SET new_week_id = w.new_id FROM weeks w WHERE t.week_id = w.id;

ALTER TABLE tasks DROP COLUMN week_id;
ALTER TABLE tasks RENAME COLUMN new_week_id TO week_id;

ALTER TABLE weeks DROP COLUMN id;
ALTER TABLE weeks RENAME COLUMN new_id TO id;
ALTER TABLE weeks ADD PRIMARY KEY (id);

ALTER TABLE tasks ADD CONSTRAINT tasks_week_id_fkey
  FOREIGN KEY (week_id) REFERENCES weeks(id) ON DELETE CASCADE;

CREATE TRIGGER weeks_activity_trigger
  AFTER INSERT OR UPDATE OR DELETE ON weeks
  FOR EACH ROW EXECUTE FUNCTION log_activity();
