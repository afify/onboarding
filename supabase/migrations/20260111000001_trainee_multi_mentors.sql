-- Add array column for multiple mentors
ALTER TABLE trainees ADD COLUMN IF NOT EXISTS assigned_mentor_ids UUID[] DEFAULT '{}';

-- Migrate existing single mentor to array
UPDATE trainees
SET assigned_mentor_ids = ARRAY[assigned_mentor_id]
WHERE assigned_mentor_id IS NOT NULL
  AND (assigned_mentor_ids IS NULL OR assigned_mentor_ids = '{}');

-- Drop the old column (optional - uncomment if you want to remove it)
-- ALTER TABLE trainees DROP COLUMN assigned_mentor_id;
