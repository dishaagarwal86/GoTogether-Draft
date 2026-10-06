-- Run after 001_gotogether_core.sql and 002_trip_room_invites.sql.
-- Persistent conversation for accepted members of a quest.
create table if not exists public.trip_room_messages (
  id text primary key,
  trip_room_id text not null references public.trip_rooms(id) on delete cascade,
  sender_id text not null references public.users(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists trip_room_messages_room_created_idx
  on public.trip_room_messages(trip_room_id, created_at asc);
