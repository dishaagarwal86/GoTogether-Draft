-- Run after 003_trip_room_messages.sql.
-- Quest Notes are opt-in, auditable group signals. They never replace an
-- individual's private preference form answers.
create table if not exists public.quest_note_settings (
  trip_room_id text primary key references public.trip_rooms(id) on delete cascade,
  enabled boolean not null default false,
  updated_by text references public.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.quest_notes (
  id text primary key,
  trip_room_id text not null references public.trip_rooms(id) on delete cascade,
  created_by text not null references public.users(id) on delete cascade,
  type text not null check (type in ('activity','mood','budget','accommodation','no_go')),
  suggestion text not null,
  proposed_action text not null,
  confidence numeric not null check (confidence >= 0 and confidence <= 1),
  mentioned_by jsonb not null default '[]'::jsonb,
  message_ids jsonb not null default '[]'::jsonb,
  group_support_count integer not null default 0,
  requires_group_confirmation boolean not null default true,
  status text not null default 'suggested' check (status in ('suggested','accepted','dismissed')),
  chosen_action text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists quest_notes_room_status_idx
  on public.quest_notes(trip_room_id, status, created_at desc);
