-- Migration: Convert task_statuses.id from SERIAL to UUID
-- This is the final table to be migrated to UUID for consistency

-- Step 1: Drop foreign key constraint from progress table
ALTER TABLE progress DROP CONSTRAINT IF EXISTS progress_status_id_fkey;

-- Step 2: Add new UUID column to task_statuses
ALTER TABLE task_statuses ADD COLUMN new_id UUID DEFAULT gen_random_uuid();

-- Step 3: Add new UUID column to progress for the foreign key
ALTER TABLE progress ADD COLUMN new_status_id UUID;

-- Step 4: Migrate the foreign key references
UPDATE progress p
SET new_status_id = s.new_id
FROM task_statuses s
WHERE p.status_id = s.id;

-- Step 5: Drop old columns and rename new ones in progress
ALTER TABLE progress DROP COLUMN status_id;
ALTER TABLE progress RENAME COLUMN new_status_id TO status_id;

-- Step 6: Drop old id and rename new_id in task_statuses
ALTER TABLE task_statuses DROP COLUMN id;
ALTER TABLE task_statuses RENAME COLUMN new_id TO id;
ALTER TABLE task_statuses ADD PRIMARY KEY (id);

-- Step 7: Re-add the foreign key constraint
ALTER TABLE progress ADD CONSTRAINT progress_status_id_fkey
  FOREIGN KEY (status_id) REFERENCES task_statuses(id) ON DELETE SET NULL;

-- Step 8: Update the comment
COMMENT ON COLUMN progress.status_id IS 'Reference to task_statuses table (UUID)';
