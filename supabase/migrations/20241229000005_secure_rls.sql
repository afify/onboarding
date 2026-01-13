ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can view leads" ON leads;
DROP POLICY IF EXISTS "Can insert own lead record" ON leads;
DROP POLICY IF EXISTS "Admin can update leads" ON leads;
DROP POLICY IF EXISTS "Admin can delete leads" ON leads;

CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
DECLARE
  user_role text;
BEGIN
  SELECT role INTO user_role FROM leads WHERE id = auth.uid();
  RETURN user_role = 'admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE POLICY "leads_select" ON leads
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "leads_insert" ON leads
  FOR INSERT WITH CHECK (is_admin() OR auth.uid() = id);

CREATE POLICY "leads_update" ON leads
  FOR UPDATE USING (is_admin() OR auth.uid() = id);

CREATE POLICY "leads_delete" ON leads
  FOR DELETE USING (is_admin());

ALTER TABLE trainees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated access" ON trainees;

CREATE POLICY "trainees_select" ON trainees
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "trainees_insert" ON trainees
  FOR INSERT WITH CHECK (is_admin());

CREATE POLICY "trainees_update" ON trainees
  FOR UPDATE USING (is_admin());

CREATE POLICY "trainees_delete" ON trainees
  FOR DELETE USING (is_admin());

ALTER TABLE progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated access" ON progress;

CREATE POLICY "progress_select" ON progress
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "progress_insert" ON progress
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "progress_update" ON progress
  FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "progress_delete" ON progress
  FOR DELETE USING (is_admin());

ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated access" ON notes;

CREATE POLICY "notes_select" ON notes
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "notes_insert" ON notes
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND lead_id = auth.uid());

CREATE POLICY "notes_update" ON notes
  FOR UPDATE USING (lead_id = auth.uid());

CREATE POLICY "notes_delete" ON notes
  FOR DELETE USING (lead_id = auth.uid() OR is_admin());

ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated access" ON activity_log;

CREATE POLICY "activity_log_select" ON activity_log
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "activity_log_insert" ON activity_log
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "activity_log_delete" ON activity_log
  FOR DELETE USING (is_admin());

ALTER TABLE weeks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "weeks_select" ON weeks
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "weeks_admin" ON weeks
  FOR ALL USING (is_admin());

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tasks_select" ON tasks
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "tasks_admin" ON tasks
  FOR ALL USING (is_admin());
