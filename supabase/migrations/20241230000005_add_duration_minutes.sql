-- Add duration_minutes column to progress table
-- Allows mentors to manually set how long a trainee took to complete a task

ALTER TABLE progress ADD COLUMN duration_minutes INT DEFAULT NULL;
