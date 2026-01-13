-- Enable realtime for all tables
-- Tables already in realtime: progress, activity_log, notes, task_categories

ALTER PUBLICATION supabase_realtime ADD TABLE mentors;
ALTER PUBLICATION supabase_realtime ADD TABLE trainees;
ALTER PUBLICATION supabase_realtime ADD TABLE weeks;
ALTER PUBLICATION supabase_realtime ADD TABLE tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE task_statuses;
