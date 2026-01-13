ALTER TABLE progress ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE progress ADD COLUMN IF NOT EXISTS due_date DATE;

ALTER TABLE progress ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;
ALTER TABLE progress ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION update_progress_dates()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'in_progress' AND (OLD.status IS NULL OR OLD.status = 'pending') AND NEW.started_at IS NULL THEN
    NEW.started_at = NOW();
  END IF;

  IF NEW.status = 'done' AND (OLD.status IS NULL OR OLD.status != 'done') THEN
    NEW.completed_at = NOW();
  END IF;

  IF OLD.status = 'done' AND NEW.status != 'done' THEN
    NEW.completed_at = NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS progress_dates_trigger ON progress;
CREATE TRIGGER progress_dates_trigger
  BEFORE INSERT OR UPDATE ON progress
  FOR EACH ROW EXECUTE FUNCTION update_progress_dates();
