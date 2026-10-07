-- Private Companion history and personalised stories; the service checks quest membership.
create table if not exists public.ai_records (
  id text primary key,
  user_id text not null references public.users(id) on delete cascade,
  trip_room_id text references public.trip_rooms(id) on delete cascade,
  task text not null check (task in ('extract','group-dna','explain','chat','personalise')),
  context_key text not null,
  data jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists ai_records_user_context on public.ai_records(user_id, context_key, created_at desc);
create index if not exists ai_records_quest_history on public.ai_records(user_id, trip_room_id, created_at desc);
create table if not exists public.ai_rate_limits (
  id text primary key,
  user_id text not null references public.users(id) on delete cascade,
  expires_at timestamptz not null
);
create index if not exists ai_rate_limits_user_expiry on public.ai_rate_limits(user_id, expires_at);
-- Browser clients have no direct access; the backend uses its service role.
alter table public.ai_records enable row level security;
alter table public.ai_rate_limits enable row level security;
