-- Security Fixes Migration
-- Fixes critical RLS policy vulnerabilities identified in security audit

-- ============================================================================
-- 1. FIX INTERVIEWS TABLE RLS - Only admins can modify
-- ============================================================================
DROP POLICY IF EXISTS "All authenticated can insert interviews" ON interviews;
DROP POLICY IF EXISTS "All authenticated can update interviews" ON interviews;
DROP POLICY IF EXISTS "All authenticated can delete interviews" ON interviews;

-- Keep SELECT for all authenticated users (needed to view interview board)
-- But restrict INSERT/UPDATE/DELETE to admins only
CREATE POLICY "Admin can insert interviews" ON interviews
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM mentors WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admin can update interviews" ON interviews
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM mentors WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admin can delete interviews" ON interviews
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM mentors WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================================
-- 2. FIX CANDIDATES TABLE RLS - Only admins can modify
-- ============================================================================
DROP POLICY IF EXISTS "All authenticated can insert candidates" ON candidates;
DROP POLICY IF EXISTS "All authenticated can update candidates" ON candidates;

CREATE POLICY "Admin can insert candidates" ON candidates
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM mentors WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admin can update candidates" ON candidates
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM mentors WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================================
-- 3. FIX INTERVIEW_SCORES TABLE RLS - Only admins can modify
-- ============================================================================
DROP POLICY IF EXISTS "All authenticated can insert interview_scores" ON interview_scores;
DROP POLICY IF EXISTS "All authenticated can update interview_scores" ON interview_scores;
DROP POLICY IF EXISTS "All authenticated can delete interview_scores" ON interview_scores;

CREATE POLICY "Admin can insert interview_scores" ON interview_scores
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM mentors WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admin can update interview_scores" ON interview_scores
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM mentors WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admin can delete interview_scores" ON interview_scores
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM mentors WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================================
-- 4. FIX MENTORS INSERT POLICY - Prevent role elevation
-- ============================================================================
DROP POLICY IF EXISTS "Users can insert their own mentor profile" ON mentors;

-- Users can only insert their own profile with 'mentor' role (not 'admin')
CREATE POLICY "Users can insert own mentor profile as mentor only" ON mentors
  FOR INSERT WITH CHECK (
    auth.uid() = id AND role = 'mentor'
  );

-- ============================================================================
-- 5. FIX PROGRESS TABLE RLS - Restrict to assigned mentors
-- ============================================================================
DROP POLICY IF EXISTS "progress_select" ON progress;
DROP POLICY IF EXISTS "progress_insert" ON progress;
DROP POLICY IF EXISTS "progress_update" ON progress;

-- Admins see all, mentors see only their assigned trainees
CREATE POLICY "progress_select_restricted" ON progress
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM mentors WHERE id = auth.uid() AND role = 'admin')
    OR EXISTS (
      SELECT 1 FROM candidates c
      WHERE c.id = progress.trainee_id
      AND auth.uid() = ANY(c.assigned_mentor_ids)
    )
  );

-- Only admins or assigned mentors can insert progress
CREATE POLICY "progress_insert_restricted" ON progress
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM mentors WHERE id = auth.uid() AND role = 'admin')
    OR EXISTS (
      SELECT 1 FROM candidates c
      WHERE c.id = trainee_id
      AND auth.uid() = ANY(c.assigned_mentor_ids)
    )
  );

-- Only admins or assigned mentors can update progress
CREATE POLICY "progress_update_restricted" ON progress
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM mentors WHERE id = auth.uid() AND role = 'admin')
    OR EXISTS (
      SELECT 1 FROM candidates c
      WHERE c.id = progress.trainee_id
      AND auth.uid() = ANY(c.assigned_mentor_ids)
    )
  );

-- ============================================================================
-- 6. FIX NOTES TABLE RLS - Only author or admin can view
-- ============================================================================
DROP POLICY IF EXISTS "notes_select" ON notes;

-- Notes visible only to the mentor who created them or admins
CREATE POLICY "notes_select_restricted" ON notes
  FOR SELECT USING (
    mentor_id = auth.uid()
    OR EXISTS (SELECT 1 FROM mentors WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================================
-- 7. FIX ACTIVITY_LOG TABLE RLS - Only admins can view all
-- ============================================================================
DROP POLICY IF EXISTS "activity_log_select" ON activity_log;

-- Activity log visible only to admins
CREATE POLICY "activity_log_admin_only" ON activity_log
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM mentors WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================================
-- 8. FIX TASK_STATUSES TABLE RLS - Only admins can manage
-- ============================================================================
DROP POLICY IF EXISTS "Authenticated users can manage statuses" ON task_statuses;
DROP POLICY IF EXISTS "Admin can insert task_statuses" ON task_statuses;
DROP POLICY IF EXISTS "Admin can update task_statuses" ON task_statuses;
DROP POLICY IF EXISTS "Admin can delete task_statuses" ON task_statuses;

-- Keep SELECT for all (needed to display status options)
-- But restrict modifications to admin only
CREATE POLICY "Admin can insert task_statuses" ON task_statuses
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM mentors WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admin can update task_statuses" ON task_statuses
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM mentors WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admin can delete task_statuses" ON task_statuses
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM mentors WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================================
-- 9. FIX INTERVIEW_STAGES TABLE RLS - Only admins can manage
-- ============================================================================
DROP POLICY IF EXISTS "All authenticated can insert stages" ON interview_stages;
DROP POLICY IF EXISTS "All authenticated can update stages" ON interview_stages;
DROP POLICY IF EXISTS "All authenticated can delete stages" ON interview_stages;
DROP POLICY IF EXISTS "Admin can insert interview_stages" ON interview_stages;
DROP POLICY IF EXISTS "Admin can update interview_stages" ON interview_stages;
DROP POLICY IF EXISTS "Admin can delete interview_stages" ON interview_stages;

CREATE POLICY "Admin can insert interview_stages" ON interview_stages
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM mentors WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admin can update interview_stages" ON interview_stages
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM mentors WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admin can delete interview_stages" ON interview_stages
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM mentors WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================================
-- 10. FIX STAGE_CRITERIA TABLE RLS - Only admins can manage
-- ============================================================================
DROP POLICY IF EXISTS "All authenticated can insert criteria" ON stage_criteria;
DROP POLICY IF EXISTS "All authenticated can update criteria" ON stage_criteria;
DROP POLICY IF EXISTS "All authenticated can delete criteria" ON stage_criteria;
DROP POLICY IF EXISTS "Admin can insert stage_criteria" ON stage_criteria;
DROP POLICY IF EXISTS "Admin can update stage_criteria" ON stage_criteria;
DROP POLICY IF EXISTS "Admin can delete stage_criteria" ON stage_criteria;

CREATE POLICY "Admin can insert stage_criteria" ON stage_criteria
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM mentors WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admin can update stage_criteria" ON stage_criteria
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM mentors WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admin can delete stage_criteria" ON stage_criteria
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM mentors WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================================
-- 11. FIX STORAGE BUCKET POLICIES - Restrict to admins
-- ============================================================================
DROP POLICY IF EXISTS "Authenticated users can upload code submissions" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can read code submissions" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete code submissions" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload resumes" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can read resumes" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete resumes" ON storage.objects;
DROP POLICY IF EXISTS "Admin can upload code submissions" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can read code submissions" ON storage.objects;
DROP POLICY IF EXISTS "Admin can delete code submissions" ON storage.objects;
DROP POLICY IF EXISTS "Admin can upload resumes" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can read resumes" ON storage.objects;
DROP POLICY IF EXISTS "Admin can delete resumes" ON storage.objects;

-- Code submissions: Admin upload/delete, all authenticated read
CREATE POLICY "Admin can upload code submissions" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'code-submissions'
    AND EXISTS (SELECT 1 FROM mentors WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Authenticated can read code submissions" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'code-submissions');

CREATE POLICY "Admin can delete code submissions" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'code-submissions'
    AND EXISTS (SELECT 1 FROM mentors WHERE id = auth.uid() AND role = 'admin')
  );

-- Resumes: Admin upload/delete, all authenticated read
CREATE POLICY "Admin can upload resumes" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'resumes'
    AND EXISTS (SELECT 1 FROM mentors WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Authenticated can read resumes" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'resumes');

CREATE POLICY "Admin can delete resumes" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'resumes'
    AND EXISTS (SELECT 1 FROM mentors WHERE id = auth.uid() AND role = 'admin')
  );
