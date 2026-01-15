-- Add code submission path column to candidates table
ALTER TABLE candidates
ADD COLUMN code_submission_path TEXT;

COMMENT ON COLUMN candidates.code_submission_path IS 'Path to code submission zip file in Supabase Storage';

-- Create storage bucket for code submissions
INSERT INTO storage.buckets (id, name, public)
VALUES ('code-submissions', 'code-submissions', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for code-submissions bucket
CREATE POLICY "Authenticated users can upload code submissions"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'code-submissions');

CREATE POLICY "Authenticated users can read code submissions"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'code-submissions');

CREATE POLICY "Authenticated users can update code submissions"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'code-submissions');

CREATE POLICY "Authenticated users can delete code submissions"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'code-submissions');
