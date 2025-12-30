-- PayTabs Onboarding Tracker - Database Schema
-- Run this in Supabase SQL Editor

-- Team Leaders (linked to Supabase Auth users)
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT DEFAULT 'lead' CHECK (role IN ('admin', 'lead')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trainees
CREATE TABLE IF NOT EXISTS trainees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT,
  assigned_lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  start_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Weekly curriculum structure
CREATE TABLE IF NOT EXISTS weeks (
  id SERIAL PRIMARY KEY,
  week_number INT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT
);

-- Tasks within each week
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_id INT REFERENCES weeks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT CHECK (category IN ('learning', 'exercise', 'project')),
  order_index INT DEFAULT 0
);

-- Progress tracking (per trainee per task)
CREATE TABLE IF NOT EXISTS progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trainee_id UUID REFERENCES trainees(id) ON DELETE CASCADE,
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'blocked', 'done')),
  updated_by UUID REFERENCES leads(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(trainee_id, task_id)
);

-- Notes/comments
CREATE TABLE IF NOT EXISTS notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trainee_id UUID REFERENCES trainees(id) ON DELETE CASCADE,
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Activity feed
CREATE TABLE IF NOT EXISTS activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE trainees ENABLE ROW LEVEL SECURITY;
ALTER TABLE weeks ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Leads: authenticated users can read all, only admin can insert/update/delete
CREATE POLICY "Authenticated users can view leads" ON leads
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin can manage leads" ON leads
  FOR ALL USING (
    EXISTS (SELECT 1 FROM leads WHERE id = auth.uid() AND role = 'admin')
  );

-- Allow insert for new user registration (handled by trigger)
CREATE POLICY "Users can insert their own lead profile" ON leads
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Trainees: all authenticated users can CRUD
CREATE POLICY "Authenticated users can manage trainees" ON trainees
  FOR ALL USING (auth.uid() IS NOT NULL);

-- Weeks: read-only for all, admin can manage
CREATE POLICY "All can view weeks" ON weeks
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin can manage weeks" ON weeks
  FOR ALL USING (
    EXISTS (SELECT 1 FROM leads WHERE id = auth.uid() AND role = 'admin')
  );

-- Tasks: read-only for all, admin can manage
CREATE POLICY "All can view tasks" ON tasks
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin can manage tasks" ON tasks
  FOR ALL USING (
    EXISTS (SELECT 1 FROM leads WHERE id = auth.uid() AND role = 'admin')
  );

-- Progress: all authenticated users can CRUD
CREATE POLICY "Authenticated users can manage progress" ON progress
  FOR ALL USING (auth.uid() IS NOT NULL);

-- Notes: all authenticated users can CRUD
CREATE POLICY "Authenticated users can manage notes" ON notes
  FOR ALL USING (auth.uid() IS NOT NULL);

-- Activity log: all authenticated users can read and insert
CREATE POLICY "Authenticated users can view activity" ON activity_log
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can log activity" ON activity_log
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Enable Realtime for progress and activity_log tables
ALTER PUBLICATION supabase_realtime ADD TABLE progress;
ALTER PUBLICATION supabase_realtime ADD TABLE activity_log;
ALTER PUBLICATION supabase_realtime ADD TABLE notes;

-- Function to log activity
CREATE OR REPLACE FUNCTION log_activity()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO activity_log (lead_id, action, entity_type, entity_id, details)
  VALUES (
    auth.uid(),
    TG_OP,
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    CASE
      WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD)
      ELSE to_jsonb(NEW)
    END
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Triggers for activity logging
CREATE TRIGGER progress_activity_trigger
  AFTER INSERT OR UPDATE OR DELETE ON progress
  FOR EACH ROW EXECUTE FUNCTION log_activity();

CREATE TRIGGER notes_activity_trigger
  AFTER INSERT OR UPDATE OR DELETE ON notes
  FOR EACH ROW EXECUTE FUNCTION log_activity();

CREATE TRIGGER trainees_activity_trigger
  AFTER INSERT OR UPDATE OR DELETE ON trainees
  FOR EACH ROW EXECUTE FUNCTION log_activity();
