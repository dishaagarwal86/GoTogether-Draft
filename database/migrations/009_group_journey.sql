-- Decisions apply only to the exact preference/plan version reviewed.
CREATE TABLE IF NOT EXISTS quest_journey_responses (
  id text PRIMARY KEY,
  room_id text NOT NULL REFERENCES trip_rooms(id) ON DELETE CASCADE,
  participant_id text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('option', 'plan')),
  option_id text NOT NULL,
  context_version text NOT NULL,
  reaction text NOT NULL CHECK (reaction IN ('love', 'works', 'concern')),
  note text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(room_id, participant_id, kind, option_id)
);
CREATE INDEX IF NOT EXISTS quest_journey_responses_room_idx ON quest_journey_responses(room_id);
ALTER TABLE quest_journey_responses ENABLE ROW LEVEL SECURITY;
-- Only the authenticated host can retrieve or rotate the invitation link.
CREATE TABLE IF NOT EXISTS quest_join_links (
  id text PRIMARY KEY REFERENCES trip_rooms(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE quest_join_links ENABLE ROW LEVEL SECURITY;
