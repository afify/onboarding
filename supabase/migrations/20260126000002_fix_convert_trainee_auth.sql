-- Fix convert_candidate_to_trainee function to require admin authorization
-- Security fix: Only admins should be able to promote candidates

CREATE OR REPLACE FUNCTION convert_candidate_to_trainee(candidate_id_param UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  candidate_record RECORD;
  is_caller_admin BOOLEAN;
BEGIN
  -- SECURITY CHECK: Verify caller is an admin
  SELECT EXISTS (
    SELECT 1 FROM mentors
    WHERE id = auth.uid() AND role = 'admin'
  ) INTO is_caller_admin;

  IF NOT is_caller_admin THEN
    RAISE EXCEPTION 'Access denied: Only admins can promote candidates to trainees';
  END IF;

  -- Get candidate data
  SELECT * INTO candidate_record FROM candidates WHERE id = candidate_id_param;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Candidate not found';
  END IF;

  IF candidate_record.status != 'active' THEN
    RAISE EXCEPTION 'Candidate is not active';
  END IF;

  IF candidate_record.type != 'candidate' THEN
    RAISE EXCEPTION 'Person is already a %', candidate_record.type;
  END IF;

  -- Update candidate to trainee (unified table approach)
  UPDATE candidates
  SET
    type = 'trainee',
    status = 'hired',
    start_date = CURRENT_DATE,
    updated_at = NOW()
  WHERE id = candidate_id_param;

  -- Return the same ID (now they're a trainee in the unified table)
  RETURN candidate_id_param;
END;
$$;
