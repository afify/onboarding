-- Interview Pipeline Feature
-- Adds pre-hiring interview tracking with configurable stages and criteria

-- ============================================
-- 1. INTERVIEW STAGES TABLE
-- ============================================
CREATE TABLE interview_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) UNIQUE NOT NULL,
  label VARCHAR(100) NOT NULL,
  description TEXT,
  color VARCHAR(20) NOT NULL DEFAULT '#6b7280',
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for interview_stages
ALTER TABLE interview_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated can view interview_stages"
  ON interview_stages FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin can insert interview_stages"
  ON interview_stages FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM mentors WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admin can update interview_stages"
  ON interview_stages FOR UPDATE
  USING (EXISTS (SELECT 1 FROM mentors WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admin can delete interview_stages"
  ON interview_stages FOR DELETE
  USING (EXISTS (SELECT 1 FROM mentors WHERE id = auth.uid() AND role = 'admin'));

-- ============================================
-- 2. STAGE CRITERIA TABLE
-- ============================================
CREATE TABLE stage_criteria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_id UUID NOT NULL REFERENCES interview_stages(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  max_score INT DEFAULT 10,
  weight DECIMAL(3,2) DEFAULT 1.0,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for stage_criteria
ALTER TABLE stage_criteria ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated can view stage_criteria"
  ON stage_criteria FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin can insert stage_criteria"
  ON stage_criteria FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM mentors WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admin can update stage_criteria"
  ON stage_criteria FOR UPDATE
  USING (EXISTS (SELECT 1 FROM mentors WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admin can delete stage_criteria"
  ON stage_criteria FOR DELETE
  USING (EXISTS (SELECT 1 FROM mentors WHERE id = auth.uid() AND role = 'admin'));

-- ============================================
-- 3. CANDIDATES TABLE
-- ============================================
CREATE TABLE candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  position_applied TEXT,
  resume_path TEXT,
  current_stage_id UUID REFERENCES interview_stages(id) ON DELETE SET NULL,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'hired', 'rejected', 'withdrawn')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for candidates
ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated can view candidates"
  ON candidates FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "All authenticated can insert candidates"
  ON candidates FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "All authenticated can update candidates"
  ON candidates FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin can delete candidates"
  ON candidates FOR DELETE
  USING (EXISTS (SELECT 1 FROM mentors WHERE id = auth.uid() AND role = 'admin'));

-- ============================================
-- 4. INTERVIEWS TABLE
-- ============================================
CREATE TABLE interviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  stage_id UUID NOT NULL REFERENCES interview_stages(id),
  interviewer_id UUID NOT NULL REFERENCES mentors(id),
  status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled')),
  overall_score DECIMAL(4,2),
  decision VARCHAR(20) CHECK (decision IN ('pass', 'fail', 'pending')),
  notes TEXT,
  scheduled_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for interviews
ALTER TABLE interviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated can view interviews"
  ON interviews FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "All authenticated can insert interviews"
  ON interviews FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "All authenticated can update interviews"
  ON interviews FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "All authenticated can delete interviews"
  ON interviews FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- ============================================
-- 5. INTERVIEW SCORES TABLE
-- ============================================
CREATE TABLE interview_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id UUID NOT NULL REFERENCES interviews(id) ON DELETE CASCADE,
  criteria_id UUID NOT NULL REFERENCES stage_criteria(id) ON DELETE CASCADE,
  score INT NOT NULL CHECK (score >= 0 AND score <= 10),
  notes TEXT,
  UNIQUE(interview_id, criteria_id)
);

-- RLS for interview_scores
ALTER TABLE interview_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated can view interview_scores"
  ON interview_scores FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "All authenticated can insert interview_scores"
  ON interview_scores FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "All authenticated can update interview_scores"
  ON interview_scores FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "All authenticated can delete interview_scores"
  ON interview_scores FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- ============================================
-- 6. ACTIVITY TRIGGERS
-- ============================================
CREATE TRIGGER candidates_activity_trigger
  AFTER INSERT OR UPDATE OR DELETE ON candidates
  FOR EACH ROW EXECUTE FUNCTION log_activity();

CREATE TRIGGER interviews_activity_trigger
  AFTER INSERT OR UPDATE OR DELETE ON interviews
  FOR EACH ROW EXECUTE FUNCTION log_activity();

CREATE TRIGGER interview_stages_activity_trigger
  AFTER INSERT OR UPDATE OR DELETE ON interview_stages
  FOR EACH ROW EXECUTE FUNCTION log_activity();

-- ============================================
-- 7. REALTIME SUBSCRIPTIONS
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE candidates;
ALTER PUBLICATION supabase_realtime ADD TABLE interviews;
ALTER PUBLICATION supabase_realtime ADD TABLE interview_stages;
ALTER PUBLICATION supabase_realtime ADD TABLE stage_criteria;

-- ============================================
-- 8. AUTO-CONVERSION FUNCTION
-- ============================================
CREATE OR REPLACE FUNCTION convert_candidate_to_trainee(candidate_id_param UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  candidate_record RECORD;
  new_trainee_id UUID;
BEGIN
  -- Get candidate data
  SELECT * INTO candidate_record FROM candidates WHERE id = candidate_id_param;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Candidate not found';
  END IF;

  IF candidate_record.status != 'active' THEN
    RAISE EXCEPTION 'Candidate is not active';
  END IF;

  -- Create trainee
  INSERT INTO trainees (name, email, start_date, assigned_mentor_ids)
  VALUES (
    candidate_record.name,
    candidate_record.email,
    CURRENT_DATE,
    '{}'::UUID[]
  )
  RETURNING id INTO new_trainee_id;

  -- Update candidate status
  UPDATE candidates
  SET status = 'hired', updated_at = NOW()
  WHERE id = candidate_id_param;

  RETURN new_trainee_id;
END;
$$;

-- ============================================
-- 9. UPDATE get_app_data() FUNCTION
-- ============================================
CREATE OR REPLACE FUNCTION get_app_data()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid;
  current_mentor json;
BEGIN
  current_user_id := auth.uid();

  SELECT row_to_json(m) INTO current_mentor
  FROM mentors m
  WHERE m.id = current_user_id;

  RETURN json_build_object(
    'mentor', current_mentor,
    'is_admin', COALESCE((current_mentor->>'role') = 'admin', false),
    'mentors', COALESCE((
      SELECT json_agg(row_to_json(m))
      FROM (SELECT * FROM mentors ORDER BY created_at) m
    ), '[]'::json),
    'trainees', COALESCE((
      SELECT json_agg(row_to_json(t))
      FROM (SELECT * FROM trainees ORDER BY created_at) t
    ), '[]'::json),
    'weeks', COALESCE((
      SELECT json_agg(row_to_json(w))
      FROM (SELECT * FROM weeks ORDER BY week_number) w
    ), '[]'::json),
    'tasks', COALESCE((
      SELECT json_agg(row_to_json(t))
      FROM (
        SELECT t.*
        FROM tasks t
        LEFT JOIN weeks w ON t.week_id = w.id
        LEFT JOIN task_categories c ON t.category_id = c.id
        ORDER BY w.week_number, t.day_number, COALESCE(c.sort_order, 100), t.order_index
      ) t
    ), '[]'::json),
    'categories', COALESCE((
      SELECT json_agg(row_to_json(c))
      FROM (SELECT * FROM task_categories ORDER BY sort_order, id) c
    ), '[]'::json),
    'statuses', COALESCE((
      SELECT json_agg(row_to_json(s))
      FROM (SELECT * FROM task_statuses ORDER BY sort_order) s
    ), '[]'::json),
    'progress', COALESCE((
      SELECT json_agg(row_to_json(p))
      FROM progress p
    ), '[]'::json),
    'activity_log', COALESCE((
      SELECT json_agg(row_to_json(a))
      FROM (SELECT * FROM activity_log ORDER BY created_at DESC LIMIT 50) a
    ), '[]'::json),
    -- Interview Pipeline Data
    'interview_stages', COALESCE((
      SELECT json_agg(row_to_json(s))
      FROM (SELECT * FROM interview_stages WHERE is_active = true ORDER BY sort_order) s
    ), '[]'::json),
    'stage_criteria', COALESCE((
      SELECT json_agg(row_to_json(c))
      FROM (SELECT * FROM stage_criteria ORDER BY stage_id, sort_order) c
    ), '[]'::json),
    'candidates', COALESCE((
      SELECT json_agg(row_to_json(c))
      FROM (SELECT * FROM candidates WHERE status = 'active' ORDER BY created_at DESC) c
    ), '[]'::json),
    'interviews', COALESCE((
      SELECT json_agg(row_to_json(i))
      FROM (SELECT * FROM interviews ORDER BY created_at DESC) i
    ), '[]'::json),
    'interview_scores', COALESCE((
      SELECT json_agg(row_to_json(s))
      FROM interview_scores s
    ), '[]'::json)
  );
END;
$$;
