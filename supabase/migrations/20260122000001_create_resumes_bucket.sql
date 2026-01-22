-- Create storage bucket for candidate resumes
INSERT INTO storage.buckets (id, name, public)
VALUES ('resumes', 'resumes', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for resumes bucket
CREATE POLICY "Authenticated users can upload resumes"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'resumes');

CREATE POLICY "Authenticated users can read resumes"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'resumes');

CREATE POLICY "Authenticated users can update resumes"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'resumes');

CREATE POLICY "Authenticated users can delete resumes"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'resumes');
