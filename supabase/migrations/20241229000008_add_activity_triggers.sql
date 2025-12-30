-- Add activity logging triggers for weeks, tasks, and mentors tables
-- This ensures all admin actions are recorded in the activity feed

-- Create triggers for weeks table
CREATE TRIGGER weeks_activity_trigger
  AFTER INSERT OR UPDATE OR DELETE ON weeks
  FOR EACH ROW EXECUTE FUNCTION log_activity();

-- Create triggers for tasks table
CREATE TRIGGER tasks_activity_trigger
  AFTER INSERT OR UPDATE OR DELETE ON tasks
  FOR EACH ROW EXECUTE FUNCTION log_activity();

-- Create triggers for mentors table
CREATE TRIGGER mentors_activity_trigger
  AFTER INSERT OR UPDATE OR DELETE ON mentors
  FOR EACH ROW EXECUTE FUNCTION log_activity();
