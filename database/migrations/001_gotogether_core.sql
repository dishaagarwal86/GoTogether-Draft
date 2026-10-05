-- Run in Supabase Dashboard → SQL Editor → New query.
create table if not exists public.users (
  id text primary key,
  first_name text,
  last_name text,
  email text unique,
  country text,
  password_hash text,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.user_sessions (
  id text primary key, user_id text not null references public.users(id) on delete cascade,
  token_hash text not null unique, expires_at timestamptz not null, created_at timestamptz not null default now()
);
create table if not exists public.trip_rooms (
  id text primary key, name text not null, trip_name text not null, start_date date, end_date date,
  status text not null default 'active' check (status in ('active','past')), members integer not null default 1,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.user_buddies (
  id bigint generated always as identity primary key, user_id text not null references public.users(id) on delete cascade,
  buddy_user_id text not null references public.users(id) on delete cascade, created_at timestamptz not null default now(),
  unique(user_id,buddy_user_id), check(user_id <> buddy_user_id)
);
create table if not exists public.trip_room_people (
  id bigint generated always as identity primary key, trip_room_id text not null references public.trip_rooms(id) on delete cascade,
  user_id text not null references public.users(id) on delete cascade, role text not null default 'member' check(role in ('owner','member')),
  invite_status text not null default 'accepted' check(invite_status in ('invited','accepted','declined')),
  created_at timestamptz not null default now(), unique(trip_room_id,user_id)
);
create table if not exists public.preferences (
  id text primary key, user_id text not null references public.users(id) on delete cascade, trip_room_id text references public.trip_rooms(id) on delete set null,
  dates jsonb, budget text, people_count integer, days_count integer, kids_involved boolean,
  location_preferences jsonb, mood_preferences jsonb, activities_must_have jsonb, activities_preferred jsonb, accommodation_preferences jsonb,
  data jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.contacts (id text primary key, user_id text not null references public.users(id) on delete cascade, data jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists public.itineraries (id text primary key, user_id text not null references public.users(id) on delete cascade, data jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists public.flights (id text primary key, user_id text not null references public.users(id) on delete cascade, itinerary_id text not null references public.itineraries(id) on delete cascade, data jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists public.hotels (id text primary key, user_id text not null references public.users(id) on delete cascade, itinerary_id text not null references public.itineraries(id) on delete cascade, data jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists public.activities (id text primary key, user_id text not null references public.users(id) on delete cascade, itinerary_id text not null references public.itineraries(id) on delete cascade, data jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists public.suggested_itineraries (id text primary key, user_id text not null references public.users(id) on delete cascade, data jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists public.country_itineraries (id text primary key, country text not null, title text not null, duration text not null, budget text not null);
create table if not exists public.itinerary_catalogue (
  id text primary key, title text not null, destination text not null, country text not null, duration_days integer not null,
  budget text not null check(budget in ('Budget-friendly','Moderate','Premium')), estimated_cost_usd integer not null,
  seasons jsonb not null, moods jsonb not null, location_type text not null, short_description text not null, why_it_fits text not null,
  daily_plan jsonb not null, ai_context jsonb not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists preferences_user_idx on public.preferences(user_id);
create index if not exists catalogue_filter_idx on public.itinerary_catalogue(budget, location_type);
create index if not exists catalogue_moods_idx on public.itinerary_catalogue using gin(moods);
create index if not exists catalogue_seasons_idx on public.itinerary_catalogue using gin(seasons);
