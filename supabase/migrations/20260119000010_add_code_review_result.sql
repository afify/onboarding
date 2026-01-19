-- Add code_review_result field to store Claude's code review
ALTER TABLE candidates
ADD COLUMN IF NOT EXISTS code_review_result JSONB;

-- Add index for querying reviewed candidates
CREATE INDEX IF NOT EXISTS idx_candidates_code_review_result
ON candidates ((code_review_result IS NOT NULL))
WHERE type = 'candidate';

COMMENT ON COLUMN candidates.code_review_result IS 'Claude API code review results: score, recommendation, analysis, issues found';
