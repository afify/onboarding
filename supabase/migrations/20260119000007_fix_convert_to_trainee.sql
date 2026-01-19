-- Fix convert_candidate_to_trainee function for unified candidates table
-- The old function inserted into the deprecated 'trainees' table
-- This version updates the type field in the unified candidates table

CREATE OR REPLACE FUNCTION convert_candidate_to_trainee(candidate_id_param UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  candidate_record RECORD;
BEGIN
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
