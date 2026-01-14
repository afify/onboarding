-- Add activity trigger for interview_scores table
CREATE TRIGGER interview_scores_activity_trigger
  AFTER INSERT OR UPDATE OR DELETE ON interview_scores
  FOR EACH ROW EXECUTE FUNCTION log_activity();
