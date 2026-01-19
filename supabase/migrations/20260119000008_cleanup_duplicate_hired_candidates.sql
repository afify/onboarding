-- Cleanup duplicate hired candidates
-- When the old convert_candidate_to_trainee function ran, it:
-- 1. Created a new record in trainees table (now migrated to candidates with type='trainee')
-- 2. Left the original candidate record with status='hired' but type='candidate'
-- This creates duplicates. This migration cleans them up.

-- Step 1: For candidates with status='hired' AND type='candidate',
-- move their interview data to the corresponding trainee record (if exists)
UPDATE interviews i
SET candidate_id = c_trainee.id
FROM candidates c_hired
JOIN candidates c_trainee ON LOWER(c_hired.name) = LOWER(c_trainee.name)
WHERE i.candidate_id = c_hired.id
AND c_hired.type = 'candidate'
AND c_hired.status = 'hired'
AND c_trainee.type = 'trainee'
AND c_hired.id != c_trainee.id;

-- Step 2: Update any hired candidates to type='trainee' if they don't have a duplicate
-- (For cases where the trainee record doesn't exist yet)
UPDATE candidates
SET type = 'trainee'
WHERE type = 'candidate'
AND status = 'hired'
AND NOT EXISTS (
  SELECT 1 FROM candidates c2
  WHERE c2.type = 'trainee'
  AND LOWER(c2.name) = LOWER(candidates.name)
  AND c2.id != candidates.id
);

-- Step 3: Delete the duplicate candidate records (where trainee record exists)
-- The trainee record should have all the relevant data now
DELETE FROM candidates
WHERE type = 'candidate'
AND status = 'hired'
AND EXISTS (
  SELECT 1 FROM candidates c2
  WHERE c2.type = 'trainee'
  AND LOWER(c2.name) = LOWER(candidates.name)
  AND c2.id != candidates.id
);
