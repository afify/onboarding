-- Secure RLS policies for all tables
-- This migration re-enables RLS on leads and ensures all tables are properly secured

-- ============================================
-- LEADS TABLE
-- ============================================
-- Re-enable RLS on leads
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Authenticated can view leads" ON leads;
DROP POLICY IF EXISTS "Can insert own lead record" ON leads;
DROP POLICY IF EXISTS "Admin can update leads" ON leads;
DROP POLICY IF EXISTS "Admin can delete leads" ON leads;

-- Recreate is_admin function with SECURITY DEFINER to avoid recursion
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
DECLARE
  user_role text;
BEGIN
  SELECT role INTO user_role FROM leads WHERE id = auth.uid();
  RETURN user_role = 'admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Policies for leads table
-- Any authenticated user can view leads (needed for displaying lead names)
CREATE POLICY "leads_select" ON leads
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Only admins can insert new leads (except during initial setup)
CREATE POLICY "leads_insert" ON leads
  FOR INSERT WITH CHECK (is_admin() OR auth.uid() = id);

-- Users can update their own record, admins can update any
CREATE POLICY "leads_update" ON leads
  FOR UPDATE USING (is_admin() OR auth.uid() = id);

-- Only admins can delete leads
CREATE POLICY "leads_delete" ON leads
  FOR DELETE USING (is_admin());

-- ============================================
-- TRAINEES TABLE
-- ============================================
ALTER TABLE trainees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated access" ON trainees;

-- All authenticated users can view trainees
CREATE POLICY "trainees_select" ON trainees
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Only admins can insert/update/delete trainees
CREATE POLICY "trainees_insert" ON trainees
  FOR INSERT WITH CHECK (is_admin());

CREATE POLICY "trainees_update" ON trainees
  FOR UPDATE USING (is_admin());

CREATE POLICY "trainees_delete" ON trainees
  FOR DELETE USING (is_admin());

-- ============================================
-- PROGRESS TABLE
-- ============================================
ALTER TABLE progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated access" ON progress;

-- All authenticated leads can view and modify progress
CREATE POLICY "progress_select" ON progress
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "progress_insert" ON progress
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "progress_update" ON progress
  FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "progress_delete" ON progress
  FOR DELETE USING (is_admin());

-- ============================================
-- NOTES TABLE
-- ============================================
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated access" ON notes;

-- All authenticated leads can view notes
CREATE POLICY "notes_select" ON notes
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Leads can insert notes (attributed to them)
CREATE POLICY "notes_insert" ON notes
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND lead_id = auth.uid());

-- Leads can only update their own notes
CREATE POLICY "notes_update" ON notes
  FOR UPDATE USING (lead_id = auth.uid());

-- Leads can only delete their own notes, admins can delete any
CREATE POLICY "notes_delete" ON notes
  FOR DELETE USING (lead_id = auth.uid() OR is_admin());

-- ============================================
-- ACTIVITY LOG TABLE
-- ============================================
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated access" ON activity_log;

-- All authenticated users can view activity log
CREATE POLICY "activity_log_select" ON activity_log
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- System/triggers insert activity logs (use service role for inserts)
-- Leads can insert their own activity
CREATE POLICY "activity_log_insert" ON activity_log
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- No updates or deletes on activity log (immutable audit trail)
-- Only admins can delete if needed for cleanup
CREATE POLICY "activity_log_delete" ON activity_log
  FOR DELETE USING (is_admin());

-- ============================================
-- WEEKS TABLE (read-only for leads)
-- ============================================
ALTER TABLE weeks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "weeks_select" ON weeks
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "weeks_admin" ON weeks
  FOR ALL USING (is_admin());

-- ============================================
-- TASKS TABLE (read-only for leads)
-- ============================================
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tasks_select" ON tasks
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "tasks_admin" ON tasks
  FOR ALL USING (is_admin());
