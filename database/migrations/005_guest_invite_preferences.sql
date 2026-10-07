-- Run after 002_trip_room_invites.sql. Guest entries contain travel answers only;
-- passwords and account credentials are never stored here.
create table if not exists public.guest_invite_preferences (
  id text primary key,
  invite_id text not null references public.trip_room_invites(id) on delete cascade,
  session_hash text not null,
  data jsonb not null default '{}'::jsonb,
  status text not null default 'submitted' check (status in ('submitted','claimed')),
  claimed_by text references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(invite_id, session_hash)
);
create index if not exists guest_invite_preferences_invite_idx on public.guest_invite_preferences(invite_id, status);
