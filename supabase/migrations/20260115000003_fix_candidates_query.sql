-- Fix get_app_data to include all candidates (not just active)
-- This allows rejected candidates to appear in the Rejected stage on the interview board

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
    -- Include ALL candidates (active, rejected, hired, withdrawn)
    'candidates', COALESCE((
      SELECT json_agg(row_to_json(c))
      FROM (SELECT * FROM candidates ORDER BY created_at DESC) c
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
