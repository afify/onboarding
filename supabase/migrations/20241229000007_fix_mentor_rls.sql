DROP POLICY IF EXISTS "Admin can manage mentors" ON mentors;
DROP POLICY IF EXISTS "Admin can manage weeks" ON weeks;
DROP POLICY IF EXISTS "Admin can manage tasks" ON tasks;

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM mentors
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE POLICY "Admin can manage mentors" ON mentors
  FOR ALL USING (is_admin() OR id = auth.uid());

CREATE POLICY "Admin can manage weeks" ON weeks
  FOR ALL USING (is_admin());

CREATE POLICY "Admin can manage tasks" ON tasks
  FOR ALL USING (is_admin());
