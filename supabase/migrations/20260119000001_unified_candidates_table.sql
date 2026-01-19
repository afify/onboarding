-- Unify candidates and trainees into a single candidates table
-- Type enum: candidate → trainee → employee

-- Create the type enum
DO $$ BEGIN
  CREATE TYPE person_type AS ENUM ('candidate', 'trainee', 'employee');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add type column to candidates (default to 'candidate')
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS type person_type DEFAULT 'candidate';

-- Add trainee-specific columns to candidates
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS assigned_mentor_id UUID REFERENCES mentors(id);
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS assigned_mentor_ids UUID[];
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS start_date DATE;

-- Migrate existing trainees to candidates table
INSERT INTO candidates (name, email, type, assigned_mentor_id, assigned_mentor_ids, start_date, status, created_at)
SELECT
  t.name,
  t.email,
  'trainee'::person_type,
  t.assigned_mentor_id,
  t.assigned_mentor_ids,
  t.start_date,
  'active',
  t.created_at
FROM trainees t
WHERE NOT EXISTS (
  SELECT 1 FROM candidates c WHERE c.email = t.email
);

-- For trainees that already exist as candidates (hired), update their type
UPDATE candidates c
SET
  type = 'trainee',
  assigned_mentor_id = t.assigned_mentor_id,
  assigned_mentor_ids = t.assigned_mentor_ids,
  start_date = t.start_date
FROM trainees t
WHERE c.email = t.email AND c.type = 'candidate';

-- Activity trigger for candidates table (includes type changes)
CREATE OR REPLACE FUNCTION log_candidate_activity()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO activity_log (action, entity_type, entity_id, details)
    VALUES (
      CASE NEW.type
        WHEN 'candidate' THEN 'New candidate added'
        WHEN 'trainee' THEN 'New trainee added'
        WHEN 'employee' THEN 'New employee added'
      END,
      'candidates',
      NEW.id,
      jsonb_build_object('name', NEW.name, 'type', NEW.type)
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Log type changes (promotions)
    IF OLD.type IS DISTINCT FROM NEW.type THEN
      INSERT INTO activity_log (action, entity_type, entity_id, details)
      VALUES (
        CASE
          WHEN OLD.type = 'candidate' AND NEW.type = 'trainee' THEN 'Candidate promoted to trainee'
          WHEN OLD.type = 'trainee' AND NEW.type = 'employee' THEN 'Trainee promoted to employee'
          ELSE 'Type changed'
        END,
        'candidates',
        NEW.id,
        jsonb_build_object('name', NEW.name, 'from_type', OLD.type, 'to_type', NEW.type)
      );
    END IF;
    -- Log status changes
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      INSERT INTO activity_log (action, entity_type, entity_id, details)
      VALUES (
        'Status changed to ' || NEW.status,
        'candidates',
        NEW.id,
        jsonb_build_object('name', NEW.name, 'from_status', OLD.status, 'to_status', NEW.status)
      );
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO activity_log (action, entity_type, entity_id, details)
    VALUES (
      CASE OLD.type
        WHEN 'candidate' THEN 'Candidate removed'
        WHEN 'trainee' THEN 'Trainee removed'
        WHEN 'employee' THEN 'Employee removed'
      END,
      'candidates',
      OLD.id,
      jsonb_build_object('name', OLD.name, 'type', OLD.type)
    );
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for candidate activity
DROP TRIGGER IF EXISTS candidates_activity_trigger ON candidates;
CREATE TRIGGER candidates_activity_trigger
  AFTER INSERT OR UPDATE OR DELETE ON candidates
  FOR EACH ROW EXECUTE FUNCTION log_candidate_activity();

-- Update get_app_data function to filter by type
CREATE OR REPLACE FUNCTION get_app_data()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'mentors', COALESCE((SELECT json_agg(row_to_json(m)) FROM mentors m), '[]'::json),
    'trainees', COALESCE((SELECT json_agg(row_to_json(c)) FROM candidates c WHERE c.type = 'trainee'), '[]'::json),
    'weeks', COALESCE((SELECT json_agg(row_to_json(w)) FROM weeks w), '[]'::json),
    'tasks', COALESCE((SELECT json_agg(row_to_json(t)) FROM tasks t), '[]'::json),
    'progress', COALESCE((SELECT json_agg(row_to_json(p)) FROM progress p), '[]'::json),
    'activity_log', COALESCE((SELECT json_agg(row_to_json(a)) FROM activity_log a ORDER BY a.created_at DESC LIMIT 100), '[]'::json),
    'categories', COALESCE((SELECT json_agg(row_to_json(c)) FROM categories c), '[]'::json),
    'task_statuses', COALESCE((SELECT json_agg(row_to_json(s)) FROM task_statuses s), '[]'::json),
    'candidates', COALESCE((SELECT json_agg(row_to_json(c)) FROM candidates c WHERE c.type = 'candidate'), '[]'::json),
    'interview_stages', COALESCE((SELECT json_agg(row_to_json(s)) FROM interview_stages s), '[]'::json),
    'stage_criteria', COALESCE((SELECT json_agg(row_to_json(sc)) FROM stage_criteria sc), '[]'::json),
    'interviews', COALESCE((SELECT json_agg(row_to_json(i)) FROM interviews i), '[]'::json),
    'interview_scores', COALESCE((SELECT json_agg(row_to_json(isc)) FROM interview_scores isc), '[]'::json)
  ) INTO result;

  RETURN result;
END;
$$;

-- Enable realtime for candidates (if not already)
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE candidates;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
