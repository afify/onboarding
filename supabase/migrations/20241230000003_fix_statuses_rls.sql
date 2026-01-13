DROP POLICY IF EXISTS "Authenticated users can manage statuses" ON task_statuses;

CREATE POLICY "Admin can manage task_statuses" ON task_statuses
  FOR ALL USING (
    EXISTS (SELECT 1 FROM mentors WHERE id = auth.uid() AND role = 'admin')
  );
