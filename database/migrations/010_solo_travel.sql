-- Mode changes are atomic and retryable on PostgreSQL and Supabase.
CREATE TABLE IF NOT EXISTS quest_mode_changes (
  room_id text NOT NULL REFERENCES trip_rooms(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  request_id text NOT NULL,
  mode text NOT NULL CHECK (mode IN ('solo', 'group')),
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (room_id, user_id, request_id)
);
ALTER TABLE quest_mode_changes ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION change_quest_mode(p_room text, p_user text, p_mode text, p_request text)
RETURNS jsonb LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  source_room trip_rooms%ROWTYPE;
  previous quest_mode_changes%ROWTYPE;
  target_room text := p_room;
  current_preferences text;
  make_copy boolean := false;
  result jsonb;
BEGIN
  IF p_mode NOT IN ('solo', 'group') OR p_request IS NULL OR length(p_request) NOT BETWEEN 20 AND 100 THEN
    RAISE EXCEPTION 'TRAVEL: Choose a travel mode and retry your change.';
  END IF;
  SELECT * INTO source_room FROM trip_rooms WHERE id = p_room FOR UPDATE;
  IF NOT FOUND OR NOT EXISTS (SELECT 1 FROM trip_room_people WHERE trip_room_id = p_room AND user_id = p_user AND role = 'owner' AND invite_status = 'accepted') THEN
    RAISE EXCEPTION 'TRAVEL: Only the host can change how this trip is planned.';
  END IF;
  SELECT * INTO previous FROM quest_mode_changes WHERE room_id = p_room AND user_id = p_user AND request_id = p_request;
  IF FOUND THEN
    IF previous.mode <> p_mode THEN RAISE EXCEPTION 'TRAVEL: This request was already used for another change.'; END IF;
    RETURN previous.result;
  END IF;
  SELECT id INTO current_preferences FROM preferences WHERE trip_room_id = p_room AND user_id = p_user
    ORDER BY updated_at DESC, id DESC LIMIT 1 FOR UPDATE;
  IF p_mode = 'solo' THEN
    make_copy := EXISTS (SELECT 1 FROM trip_room_people WHERE trip_room_id = p_room AND user_id <> p_user AND invite_status IN ('accepted', 'invited'))
      OR EXISTS (SELECT 1 FROM trip_room_invites WHERE trip_room_id = p_room AND status = 'pending');
    IF make_copy THEN
      target_room := 'room_' || gen_random_uuid()::text;
      INSERT INTO trip_rooms(id, name, trip_name, members)
        VALUES(target_room, left(source_room.name, 84) || ' · My solo trip', source_room.trip_name, 1);
      INSERT INTO trip_room_people(trip_room_id, user_id, role, invite_status) VALUES(target_room, p_user, 'owner', 'accepted');
      INSERT INTO preferences(id, user_id, trip_room_id, dates, budget, people_count, days_count, kids_involved, location_preferences, mood_preferences, activities_must_have, activities_preferred, accommodation_preferences, data)
        SELECT 'pref_' || gen_random_uuid()::text, p_user, target_room, dates, budget, 1, days_count, kids_involved, location_preferences, mood_preferences, activities_must_have, activities_preferred, accommodation_preferences, data || '{"companions":"solo"}'::jsonb
        FROM preferences WHERE id = current_preferences;
      -- Preserve the edited document and locks; a copy starts its own undo history.
      INSERT INTO quest_working_plans(id, data)
        SELECT target_room, jsonb_build_object('document', data->'document', 'history', '[]'::jsonb, 'requests', '[]'::jsonb)
        FROM quest_working_plans WHERE id = p_room;
      -- Only the caller's own saved ideas are copied. Nobody else's private data.
      INSERT INTO quest_picks(id, trip_room_id, user_id, type, title, destination, estimated_price, note, link, image_url, source_data)
        SELECT 'pick_' || gen_random_uuid()::text, target_room, p_user, type, title, q.destination, estimated_price, note, link, image_url, source_data
        FROM quest_picks q WHERE trip_room_id = p_room AND user_id = p_user;
    ELSE
      UPDATE trip_rooms SET members = 1, updated_at = now() WHERE id = p_room;
      UPDATE preferences SET people_count = 1, data = data || '{"companions":"solo"}'::jsonb, updated_at = now()
        WHERE id = current_preferences;
      DELETE FROM quest_join_links WHERE id = p_room;
    END IF;
  ELSE
    UPDATE trip_rooms SET members = greatest(2, members), updated_at = now() WHERE id = p_room;
    UPDATE preferences SET data = data || '{"companions":"friends"}'::jsonb, updated_at = now()
      WHERE id = current_preferences AND data->>'companions' = 'solo';
  END IF;
  result := jsonb_build_object('roomId', target_room, 'copied', make_copy, 'mode', p_mode);
  INSERT INTO quest_mode_changes(room_id, user_id, request_id, mode, result) VALUES(p_room, p_user, p_request, p_mode, result);
  RETURN result;
END $$;

-- Re-check the capability after locking the same room used by mode changes.
-- A join already in flight cannot reopen a room after it becomes solo.
CREATE OR REPLACE FUNCTION join_quest_by_link(p_token text, p_user text)
RETURNS jsonb LANGUAGE plpgsql SET search_path = public AS $$
DECLARE target_room text;
BEGIN
  SELECT id INTO target_room FROM quest_join_links WHERE token = p_token;
  IF target_room IS NULL THEN RAISE EXCEPTION 'TRAVEL: This invitation is no longer available.'; END IF;
  PERFORM 1 FROM trip_rooms WHERE id = target_room FOR UPDATE;
  IF NOT EXISTS (SELECT 1 FROM quest_join_links WHERE id = target_room AND token = p_token) THEN
    RAISE EXCEPTION 'TRAVEL: This invitation is no longer available.';
  END IF;
  INSERT INTO trip_room_people(trip_room_id, user_id, role, invite_status)
    VALUES(target_room, p_user, 'member', 'accepted')
    ON CONFLICT (trip_room_id, user_id) DO UPDATE SET invite_status = 'accepted';
  RETURN jsonb_build_object('roomId', target_room);
END $$;

REVOKE ALL ON FUNCTION join_quest_by_link(text,text) FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION join_quest_by_link(text,text) TO service_role;
  END IF;
END $$;

REVOKE ALL ON FUNCTION change_quest_mode(text,text,text,text) FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION change_quest_mode(text,text,text,text) TO service_role;
  END IF;
END $$;
