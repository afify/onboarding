-- Fix progress table to reference unified candidates table
-- SAFE MIGRATION: Does NOT delete any progress data

-- Step 1: Drop the old foreign key constraint (allows us to update the references)
ALTER TABLE progress DROP CONSTRAINT IF EXISTS progress_trainee_id_fkey;

-- Step 2: Update progress.trainee_id to use the new candidate ID
-- Match by name since trainees might not have had emails
UPDATE progress p
SET trainee_id = c.id
FROM trainees t
JOIN candidates c ON LOWER(t.name) = LOWER(c.name) AND c.type = 'trainee'
WHERE p.trainee_id = t.id;

-- Step 3: Add the new foreign key constraint to candidates table
ALTER TABLE progress
ADD CONSTRAINT progress_trainee_id_fkey
FOREIGN KEY (trainee_id) REFERENCES candidates(id) ON DELETE CASCADE;

-- Step 4: Also fix notes table foreign key
ALTER TABLE notes DROP CONSTRAINT IF EXISTS notes_trainee_id_fkey;

UPDATE notes n
SET trainee_id = c.id
FROM trainees t
JOIN candidates c ON LOWER(t.name) = LOWER(c.name) AND c.type = 'trainee'
WHERE n.trainee_id = t.id;

ALTER TABLE notes
ADD CONSTRAINT notes_trainee_id_fkey
FOREIGN KEY (trainee_id) REFERENCES candidates(id) ON DELETE CASCADE;

-- Step 5: For duplicate records (candidate who was hired and also exists as trainee),
-- move any interview data from the candidate record to the trainee record
-- This preserves all interview history on the trainee record
UPDATE interviews i
SET candidate_id = c_trainee.id
FROM candidates c_candidate
JOIN candidates c_trainee ON LOWER(c_candidate.name) = LOWER(c_trainee.name)
WHERE i.candidate_id = c_candidate.id
AND c_candidate.type = 'candidate'
AND c_trainee.type = 'trainee'
AND c_candidate.id != c_trainee.id;

-- Note: We do NOT delete the duplicate candidate records here
-- They can be cleaned up manually after verifying all data is preserved
