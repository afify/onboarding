-- Rename leads table to mentors and update all references
-- This migration renames "Team Lead" terminology to "Mentor"

-- Drop existing policies that reference leads table
DROP POLICY IF EXISTS "Authenticated users can view leads" ON leads;
DROP POLICY IF EXISTS "Admin can manage leads" ON leads;
DROP POLICY IF EXISTS "Users can insert their own lead profile" ON leads;
DROP POLICY IF EXISTS "Admin can manage weeks" ON weeks;
DROP POLICY IF EXISTS "Admin can manage tasks" ON tasks;

-- Rename the table
ALTER TABLE leads RENAME TO mentors;

-- Rename role check constraint - need to recreate it
ALTER TABLE mentors DROP CONSTRAINT IF EXISTS leads_role_check;
ALTER TABLE mentors ADD CONSTRAINT mentors_role_check CHECK (role IN ('admin', 'mentor'));

-- Update default role value
ALTER TABLE mentors ALTER COLUMN role SET DEFAULT 'mentor';

-- Update existing 'lead' roles to 'mentor'
UPDATE mentors SET role = 'mentor' WHERE role = 'lead';

-- Rename foreign key columns in other tables
ALTER TABLE trainees RENAME COLUMN assigned_lead_id TO assigned_mentor_id;
ALTER TABLE progress RENAME COLUMN updated_by TO updated_by_mentor_id;
ALTER TABLE notes RENAME COLUMN lead_id TO mentor_id;
ALTER TABLE activity_log RENAME COLUMN lead_id TO mentor_id;

-- Recreate RLS policies with new table name

-- Mentors: authenticated users can read all, only admin can insert/update/delete
CREATE POLICY "Authenticated users can view mentors" ON mentors
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin can manage mentors" ON mentors
  FOR ALL USING (
    EXISTS (SELECT 1 FROM mentors WHERE id = auth.uid() AND role = 'admin')
  );

-- Allow insert for new user registration (handled by trigger)
CREATE POLICY "Users can insert their own mentor profile" ON mentors
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Update policies that reference mentors table
DROP POLICY IF EXISTS "All can view weeks" ON weeks;
CREATE POLICY "All can view weeks" ON weeks
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin can manage weeks" ON weeks
  FOR ALL USING (
    EXISTS (SELECT 1 FROM mentors WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "All can view tasks" ON tasks;
CREATE POLICY "All can view tasks" ON tasks
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin can manage tasks" ON tasks
  FOR ALL USING (
    EXISTS (SELECT 1 FROM mentors WHERE id = auth.uid() AND role = 'admin')
  );
