-- Run after 001_gotogether_core.sql in Supabase SQL Editor.
create table if not exists public.trip_room_invites (
  id text primary key,
  trip_room_id text not null references public.trip_rooms(id) on delete cascade,
  email text not null,
  token_hash text not null unique,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked', 'expired')),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (trip_room_id, email)
);

create index if not exists trip_room_invites_token_idx on public.trip_room_invites(token_hash);
create index if not exists trip_room_invites_room_idx on public.trip_room_invites(trip_room_id);
