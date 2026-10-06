-- Run after 001–005. Personal picks remain private until explicitly shared.
create table if not exists public.quest_picks (
  id text primary key,
  trip_room_id text not null references public.trip_rooms(id) on delete cascade,
  user_id text not null references public.users(id) on delete cascade,
  type text not null check (type in ('flight','stay','activity','itinerary')),
  title text not null,
  destination text,
  estimated_price numeric,
  note text,
  link text,
  image_url text,
  source_data jsonb not null default '{}'::jsonb,
  shared_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.quest_shared_picks (
  id text primary key,
  trip_room_id text not null references public.trip_rooms(id) on delete cascade,
  pick_id text references public.quest_picks(id) on delete set null,
  shared_by_user_id text not null references public.users(id) on delete cascade,
  type text not null check (type in ('flight','stay','activity','itinerary')),
  title text not null,
  destination text,
  estimated_price numeric,
  note text,
  link text,
  image_url text,
  source_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create table if not exists public.quest_pick_reactions (
  id text primary key,
  shared_pick_id text not null references public.quest_shared_picks(id) on delete cascade,
  user_id text not null references public.users(id) on delete cascade,
  reaction text not null check (reaction in ('love','works','not_for_me')),
  note text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(shared_pick_id, user_id)
);
create index if not exists quest_picks_room_user_idx on public.quest_picks(trip_room_id, user_id);
create index if not exists quest_shared_picks_room_idx on public.quest_shared_picks(trip_room_id, created_at desc);
create index if not exists quest_pick_reactions_pick_idx on public.quest_pick_reactions(shared_pick_id);
