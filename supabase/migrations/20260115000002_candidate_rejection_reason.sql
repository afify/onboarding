-- Add rejection tracking fields to candidates table
ALTER TABLE candidates
ADD COLUMN rejection_reason TEXT,
ADD COLUMN rejected_at TIMESTAMPTZ,
ADD COLUMN rejected_by UUID REFERENCES mentors(id);

COMMENT ON COLUMN candidates.rejection_reason IS 'Reason for rejecting the candidate';
COMMENT ON COLUMN candidates.rejected_at IS 'Timestamp when candidate was rejected';
COMMENT ON COLUMN candidates.rejected_by IS 'Mentor who rejected the candidate';
