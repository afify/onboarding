-- Remove the Rejected stage from interview_stages
-- Rejection is now a hardcoded status column, not a configurable stage

-- Clear current_stage_id for candidates that were in the rejected stage
UPDATE candidates
SET current_stage_id = NULL
WHERE current_stage_id IN (
  SELECT id FROM interview_stages
  WHERE name = 'rejected' OR LOWER(label) = 'rejected'
);

-- Delete the rejected stage
DELETE FROM interview_stages
WHERE name = 'rejected' OR LOWER(label) = 'rejected';
