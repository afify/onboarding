-- Fix task_statuses RLS to restrict management to admins only

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Authenticated users can manage statuses" ON task_statuses;

-- Create admin-only management policy (matching task_categories pattern)
CREATE POLICY "Admin can manage task_statuses" ON task_statuses
  FOR ALL USING (
    EXISTS (SELECT 1 FROM mentors WHERE id = auth.uid() AND role = 'admin')
  );
