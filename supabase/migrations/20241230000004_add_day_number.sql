-- Add day_number column to tasks table
-- Allows grouping tasks by day (1-7) within each week

ALTER TABLE tasks ADD COLUMN day_number INT DEFAULT 1;
ALTER TABLE tasks ADD CONSTRAINT day_number_range CHECK (day_number BETWEEN 1 AND 7);

-- Update existing tasks to have day_number based on their order_index
-- This distributes existing tasks across days 1-5 (weekdays)
UPDATE tasks SET day_number = LEAST(order_index, 5);
