-- Add date tracking columns to progress table

-- Planned dates (set by mentors)
ALTER TABLE progress ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE progress ADD COLUMN IF NOT EXISTS due_date DATE;

-- Actual dates (set automatically when status changes)
ALTER TABLE progress ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;
ALTER TABLE progress ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- Create function to auto-update actual dates based on status
CREATE OR REPLACE FUNCTION update_progress_dates()
RETURNS TRIGGER AS $$
BEGIN
  -- Set started_at when status changes to in_progress for the first time
  IF NEW.status = 'in_progress' AND (OLD.status IS NULL OR OLD.status = 'pending') AND NEW.started_at IS NULL THEN
    NEW.started_at = NOW();
  END IF;

  -- Set completed_at when status changes to done
  IF NEW.status = 'done' AND (OLD.status IS NULL OR OLD.status != 'done') THEN
    NEW.completed_at = NOW();
  END IF;

  -- Clear completed_at if status changes from done to something else
  IF OLD.status = 'done' AND NEW.status != 'done' THEN
    NEW.completed_at = NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update dates
DROP TRIGGER IF EXISTS progress_dates_trigger ON progress;
CREATE TRIGGER progress_dates_trigger
  BEFORE INSERT OR UPDATE ON progress
  FOR EACH ROW EXECUTE FUNCTION update_progress_dates();
