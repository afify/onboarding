ALTER TABLE tasks ADD COLUMN day_number INT DEFAULT 1;
ALTER TABLE tasks ADD CONSTRAINT day_number_range CHECK (day_number BETWEEN 1 AND 7);

UPDATE tasks SET day_number = LEAST(order_index, 5);
