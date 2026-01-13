DROP POLICY IF EXISTS "Admin can manage leads" ON leads;
DROP POLICY IF EXISTS "Leads can view all leads" ON leads;
DROP POLICY IF EXISTS "Authenticated users can view leads" ON leads;

CREATE POLICY "Authenticated can view leads" ON leads
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Can insert own lead record" ON leads
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM leads
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE POLICY "Admin can update leads" ON leads
  FOR UPDATE USING (is_admin() OR auth.uid() = id);

CREATE POLICY "Admin can delete leads" ON leads
  FOR DELETE USING (is_admin());
