-- Private travel evidence and pilot perks. App sessions are enforced by Express;
-- these tables/functions are available only to the backend database role.
CREATE TABLE IF NOT EXISTS travel_profiles (
  user_id text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  learning_enabled boolean NOT NULL DEFAULT true,
  use_enabled boolean NOT NULL DEFAULT true
);
CREATE TABLE IF NOT EXISTS travel_edit_events (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  room_id text NOT NULL REFERENCES trip_rooms(id) ON DELETE CASCADE,
  revision integer NOT NULL,
  data jsonb NOT NULL,
  reversed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS travel_imports (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','confirmed')),
  fingerprint text,
  data jsonb NOT NULL,
  awarded_points integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS travel_memories (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  feature text NOT NULL CHECK (feature IN ('day_start','pace','interest','avoid_activity')),
  value text NOT NULL,
  context text NOT NULL,
  source text NOT NULL CHECK (source IN ('edit','import','manual')),
  event_id text REFERENCES travel_edit_events(id) ON DELETE CASCADE,
  import_id text REFERENCES travel_imports(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS travel_wallets (
  user_id text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  points integer NOT NULL DEFAULT 0 CHECK (points >= 0),
  credits integer NOT NULL DEFAULT 3 CHECK (credits >= 0)
);
CREATE TABLE IF NOT EXISTS travel_ledger (
  id bigserial PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_key text NOT NULL,
  kind text NOT NULL,
  points_delta integer NOT NULL DEFAULT 0,
  credits_delta integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, source_key)
);
CREATE TABLE IF NOT EXISTS travel_ai_jobs (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  room_id text NOT NULL REFERENCES trip_rooms(id) ON DELETE CASCADE,
  request_id text NOT NULL,
  fingerprint text NOT NULL,
  base_revision integer NOT NULL,
  state text NOT NULL CHECK (state IN ('pending','ready','failed','dismissed','applied')),
  credit_charged boolean NOT NULL DEFAULT false,
  expires_at timestamptz NOT NULL DEFAULT now() + interval '90 seconds',
  data jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, request_id)
);
CREATE INDEX IF NOT EXISTS travel_memories_user_idx ON travel_memories(user_id);
CREATE INDEX IF NOT EXISTS travel_imports_user_idx ON travel_imports(user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS travel_jobs_user_idx ON travel_ai_jobs(user_id,room_id,created_at DESC);
CREATE INDEX IF NOT EXISTS travel_events_user_idx ON travel_edit_events(user_id,room_id);
CREATE INDEX IF NOT EXISTS travel_ledger_user_idx ON travel_ledger(user_id,created_at DESC);
ALTER TABLE travel_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE travel_edit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE travel_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE travel_memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE travel_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE travel_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE travel_ai_jobs ENABLE ROW LEVEL SECURITY;

-- All wallet writes serialize on one row. A model call never holds this lock.
-- A private action either commits its import/memories/ledger together or none.
CREATE OR REPLACE FUNCTION travel_action(p_user text, p_action text, p_input jsonb DEFAULT '{}')
RETURNS jsonb LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  w travel_wallets; j travel_ai_jobs; imp travel_imports; e travel_edit_events;
  m jsonb; award integer := 0; created integer; result jsonb := '{}';
BEGIN
  INSERT INTO travel_profiles(user_id) VALUES(p_user) ON CONFLICT DO NOTHING;
  INSERT INTO travel_wallets(user_id) VALUES(p_user) ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS created = ROW_COUNT;
  SELECT * INTO w FROM travel_wallets WHERE user_id=p_user FOR UPDATE;
  IF created=1 THEN
    INSERT INTO travel_ledger(user_id,source_key,kind,credits_delta) VALUES(p_user,'welcome','welcome',3);
  END IF;
  -- Recovery runs on every private action/read. A timed-out worker cannot later charge.
  FOR j IN SELECT * FROM travel_ai_jobs WHERE user_id=p_user AND state='pending' AND expires_at<=now() FOR UPDATE LOOP
    UPDATE travel_ai_jobs SET state='failed',data='{"notice":"This request expired. Your credit was returned."}' WHERE id=j.id;
    UPDATE travel_wallets SET credits=credits+1 WHERE user_id=p_user;
    INSERT INTO travel_ledger(user_id,source_key,kind,credits_delta) VALUES(p_user,'release:'||j.id,'release',1) ON CONFLICT DO NOTHING;
  END LOOP;
  IF p_action='settings' THEN
    UPDATE travel_profiles SET learning_enabled=COALESCE((p_input->>'learningEnabled')::boolean,learning_enabled),use_enabled=COALESCE((p_input->>'useEnabled')::boolean,use_enabled) WHERE user_id=p_user;
  ELSIF p_action='remember' THEN
    SELECT * INTO e FROM travel_edit_events WHERE id=p_input->>'eventId' AND user_id=p_user FOR UPDATE;
    IF NOT FOUND OR e.reversed OR e.data->'signal' IS NULL OR e.data->'signal'='null'::jsonb THEN RAISE EXCEPTION 'TRAVEL: This edit is no longer available to remember.'; END IF;
    IF NOT (SELECT learning_enabled FROM travel_profiles WHERE user_id=p_user) THEN RAISE EXCEPTION 'TRAVEL: Memory suggestions are paused.'; END IF;
    INSERT INTO travel_memories(id,user_id,feature,value,context,source,event_id)
      VALUES('edit:'||e.id,p_user,e.data->'signal'->>'feature',e.data->'signal'->>'value',p_input->>'context','edit',e.id)
      ON CONFLICT(id) DO UPDATE SET context=excluded.context;
  ELSIF p_action='memory' THEN
    -- Explicit corrections replace the same dimension in that context; interests can coexist.
    DELETE FROM travel_memories WHERE user_id=p_user AND context=p_input->>'context' AND feature=p_input->>'feature'
      AND (feature NOT IN ('interest','avoid_activity') OR value=p_input->>'value');
    INSERT INTO travel_memories(id,user_id,feature,value,context,source)
      VALUES(p_input->>'id',p_user,p_input->>'feature',p_input->>'value',p_input->>'context','manual');
  ELSIF p_action='forget' THEN
    DELETE FROM travel_memories WHERE id=p_input->>'id' AND user_id=p_user;
  ELSIF p_action='reset' THEN
    DELETE FROM travel_memories WHERE user_id=p_user;
    UPDATE travel_edit_events SET data=data-'signal' WHERE user_id=p_user;
  ELSIF p_action='import_draft' THEN
    IF (SELECT count(*) FROM travel_imports WHERE user_id=p_user)>=100 THEN RAISE EXCEPTION 'TRAVEL: Your travel book is full. Remove an old import first.'; END IF;
    INSERT INTO travel_imports(id,user_id,data) VALUES(p_input->>'id',p_user,p_input->'data');
    result:=jsonb_build_object('importId',p_input->>'id');
  ELSIF p_action='import_update' THEN
    UPDATE travel_imports SET data=p_input->'data' WHERE id=p_input->>'id' AND user_id=p_user AND status='draft';
    IF NOT FOUND THEN RAISE EXCEPTION 'TRAVEL: This draft is unavailable or already confirmed.'; END IF;
  ELSIF p_action='import_confirm' THEN
    SELECT * INTO imp FROM travel_imports WHERE id=p_input->>'id' AND user_id=p_user FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'TRAVEL: This past trip is unavailable.'; END IF;
    IF imp.status='draft' THEN
      IF EXISTS(SELECT 1 FROM travel_ledger WHERE user_id=p_user AND source_key IN ('history:'||(p_input->>'fingerprint'), 'history-content:'||(p_input->>'contentFingerprint')))
        OR EXISTS(SELECT 1 FROM travel_imports WHERE user_id=p_user AND status='confirmed' AND fingerprint=p_input->>'fingerprint')
        THEN RAISE EXCEPTION 'TRAVEL: This trip has already been contributed. It cannot earn points again.'; END IF;
      IF (p_input->>'rewardEligible')::boolean AND (SELECT count(*) FROM travel_ledger WHERE user_id=p_user AND kind='history' AND points_delta>0 AND created_at>=date_trunc('month',now()))<3 THEN award:=100; END IF;
      UPDATE travel_imports SET status='confirmed',data=p_input->'data',fingerprint=p_input->>'fingerprint',awarded_points=award WHERE id=imp.id;
      -- Keep a hash receipt even when the cap is reached or the source is later deleted.
      INSERT INTO travel_ledger(user_id,source_key,kind,points_delta) VALUES(p_user,'history:'||(p_input->>'fingerprint'),'history',award);
      INSERT INTO travel_ledger(user_id,source_key,kind) VALUES(p_user,'history-content:'||(p_input->>'contentFingerprint'),'history_receipt');
      UPDATE travel_wallets SET points=points+award WHERE user_id=p_user;
      FOR m IN SELECT value FROM jsonb_array_elements(COALESCE(p_input->'memories','[]')) WHERE (SELECT learning_enabled FROM travel_profiles WHERE user_id=p_user) LOOP
        INSERT INTO travel_memories(id,user_id,feature,value,context,source,import_id)
          VALUES(m->>'id',p_user,m->>'feature',m->>'value',m->>'context','import',imp.id);
      END LOOP;
    ELSE award:=imp.awarded_points; END IF;
    result:=jsonb_build_object('awardedPoints',award);
  ELSIF p_action='import_delete' THEN
    DELETE FROM travel_imports WHERE id=p_input->>'id' AND user_id=p_user;
  ELSIF p_action='redeem' THEN
    IF NOT EXISTS(SELECT 1 FROM travel_ledger WHERE user_id=p_user AND source_key='redeem:'||(p_input->>'requestId')) THEN
      IF (SELECT points FROM travel_wallets WHERE user_id=p_user)<100 THEN RAISE EXCEPTION 'TRAVEL: You need 100 points for this perk.'; END IF;
      UPDATE travel_wallets SET points=points-100,credits=credits+5 WHERE user_id=p_user;
      INSERT INTO travel_ledger(user_id,source_key,kind,points_delta,credits_delta) VALUES(p_user,'redeem:'||(p_input->>'requestId'),'redeem',-100,5);
    END IF;
  ELSIF p_action='reserve' THEN
    SELECT * INTO j FROM travel_ai_jobs WHERE user_id=p_user AND request_id=p_input->>'requestId';
    IF FOUND THEN
      IF j.fingerprint<>p_input->>'fingerprint' THEN RAISE EXCEPTION 'TRAVEL: This request ID was already used for a different change.'; END IF;
      RETURN jsonb_build_object('job',to_jsonb(j),'created',false);
    END IF;
    IF (SELECT credits FROM travel_wallets WHERE user_id=p_user)<1 THEN RAISE EXCEPTION 'TRAVEL: No planning credits left. Manual edits are always available.'; END IF;
    INSERT INTO travel_ai_jobs(id,user_id,room_id,request_id,fingerprint,base_revision,state,data)
      VALUES(p_input->>'id',p_user,p_input->>'roomId',p_input->>'requestId',p_input->>'fingerprint',(p_input->>'revision')::integer,'pending',p_input->'data') RETURNING * INTO j;
    UPDATE travel_wallets SET credits=credits-1 WHERE user_id=p_user;
    INSERT INTO travel_ledger(user_id,source_key,kind,credits_delta) VALUES(p_user,'reserve:'||j.id,'reserve',-1);
    RETURN jsonb_build_object('job',to_jsonb(j),'created',true);
  ELSIF p_action='finish' THEN
    SELECT * INTO j FROM travel_ai_jobs WHERE id=p_input->>'id' AND user_id=p_user FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'TRAVEL: Planning request not found.'; END IF;
    IF j.state='pending' THEN
      UPDATE travel_ai_jobs SET state=CASE WHEN jsonb_array_length(p_input->'data'->'commands')>0 THEN 'ready' ELSE 'failed' END,
        data=p_input->'data',credit_charged=(p_input->>'charge')::boolean WHERE id=j.id;
      IF (p_input->>'charge')::boolean THEN
        INSERT INTO travel_ledger(user_id,source_key,kind) VALUES(p_user,'capture:'||j.id,'capture');
      ELSE
        UPDATE travel_wallets SET credits=credits+1 WHERE user_id=p_user;
        INSERT INTO travel_ledger(user_id,source_key,kind,credits_delta) VALUES(p_user,'release:'||j.id,'release',1);
      END IF;
    END IF;
    SELECT to_jsonb(x) INTO result FROM travel_ai_jobs x WHERE id=j.id;
    RETURN jsonb_build_object('job',result);
  ELSIF p_action='dismiss' THEN
    UPDATE travel_ai_jobs SET state='dismissed' WHERE id=p_input->>'id' AND user_id=p_user AND room_id=p_input->>'roomId' AND state='ready';
  ELSIF p_action<>'read' THEN RAISE EXCEPTION 'TRAVEL: Unknown action.';
  END IF;
  RETURN result || jsonb_build_object(
    'settings',(SELECT jsonb_build_object('learningEnabled',learning_enabled,'useEnabled',use_enabled) FROM travel_profiles WHERE user_id=p_user),
    'wallet',(SELECT jsonb_build_object('points',points,'credits',credits,'reserved',(SELECT count(*) FROM travel_ai_jobs WHERE user_id=p_user AND state='pending')) FROM travel_wallets WHERE user_id=p_user),
    'memories',COALESCE((SELECT jsonb_agg(to_jsonb(mem) ORDER BY mem.created_at DESC) FROM travel_memories mem LEFT JOIN travel_edit_events ev ON ev.id=mem.event_id WHERE mem.user_id=p_user AND (mem.event_id IS NULL OR NOT ev.reversed)),'[]'),
    'imports',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',id,'status',status,'title',data->>'title','destination',data->>'destination','endDate',data->>'endDate','awardedPoints',awarded_points) ORDER BY created_at DESC) FROM travel_imports WHERE user_id=p_user),'[]'),
    'ledger',COALESCE((SELECT jsonb_agg(to_jsonb(l)) FROM (SELECT kind,points_delta,credits_delta,created_at FROM travel_ledger WHERE user_id=p_user AND kind<>'history_receipt' ORDER BY id DESC LIMIT 20) l),'[]')
  );
END $$;

-- A saved revision, its evidence, an undo reversal, and proposal application
-- share a transaction. Clients cannot forge learning evidence via the API.
CREATE OR REPLACE FUNCTION commit_travel_plan(p_user text,p_room text,p_revision integer,p_request text,p_data jsonb,p_event jsonb,p_undo text DEFAULT NULL,p_proposal text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SET search_path=public AS $$
DECLARE r quest_working_plans; j travel_ai_jobs;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM trip_room_people WHERE trip_room_id=p_room AND user_id=p_user AND role='owner' AND invite_status='accepted') THEN RAISE EXCEPTION 'TRAVEL: Only the quest host can edit this plan.'; END IF;
  SELECT * INTO r FROM quest_working_plans WHERE id=p_room FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'TRAVEL: Save a starting plan first.'; END IF;
  IF r.data->'requests' ? p_request THEN RETURN to_jsonb(r); END IF;
  IF r.revision<>p_revision THEN RAISE EXCEPTION 'TRAVEL: The plan changed in another window. Load the latest version.'; END IF;
  IF p_proposal IS NOT NULL THEN
    SELECT * INTO j FROM travel_ai_jobs WHERE id=p_proposal AND user_id=p_user AND room_id=p_room FOR UPDATE;
    IF NOT FOUND OR j.state<>'ready' OR j.base_revision<>r.revision THEN RAISE EXCEPTION 'TRAVEL: This suggestion is no longer current. Ask for a new preview.'; END IF;
    UPDATE travel_ai_jobs SET state='applied' WHERE id=j.id;
  END IF;
  UPDATE quest_working_plans SET data=p_data,revision=revision+1,updated_at=now() WHERE id=p_room RETURNING * INTO r;
  IF p_undo IS NOT NULL THEN UPDATE travel_edit_events SET reversed=true WHERE id=p_undo AND room_id=p_room AND user_id=p_user; END IF;
  INSERT INTO travel_edit_events(id,user_id,room_id,revision,data) VALUES(p_room||':'||p_request,p_user,p_room,r.revision,p_event);
  RETURN to_jsonb(r);
END $$;
REVOKE ALL ON FUNCTION travel_action(text,text,jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION commit_travel_plan(text,text,integer,text,jsonb,jsonb,text,text) FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
    GRANT EXECUTE ON FUNCTION travel_action(text,text,jsonb) TO service_role;
    GRANT EXECUTE ON FUNCTION commit_travel_plan(text,text,integer,text,jsonb,jsonb,text,text) TO service_role;
  END IF;
END $$;
