-- Add sort_order column to task_categories for controlling display order
ALTER TABLE task_categories ADD COLUMN IF NOT EXISTS sort_order INT DEFAULT 100;

-- Set sort order: admin=1, meeting=2, learning=3, exercise=4, project=5
UPDATE task_categories SET sort_order = 1 WHERE name = 'admin';
UPDATE task_categories SET sort_order = 2 WHERE name = 'meeting';
UPDATE task_categories SET sort_order = 3 WHERE name = 'learning';
UPDATE task_categories SET sort_order = 4 WHERE name = 'exercise';
UPDATE task_categories SET sort_order = 5 WHERE name = 'project';

-- Update get_app_data function to order tasks by week_number, day_number, then category sort_order
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
    ), '[]'::json)
  );
END;
$$;
