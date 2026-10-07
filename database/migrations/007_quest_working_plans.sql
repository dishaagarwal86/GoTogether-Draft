-- One shared working draft per quest. A revision and its undo snapshots are
-- written in the same compare-and-swap update on both database providers.
CREATE TABLE IF NOT EXISTS quest_working_plans (
  id text PRIMARY KEY REFERENCES trip_rooms(id) ON DELETE CASCADE,
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  data jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE quest_working_plans ENABLE ROW LEVEL SECURITY;
-- App sessions are checked by Express; use the server's database role only.
