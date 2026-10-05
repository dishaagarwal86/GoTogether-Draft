# Go.Together API

The API uses Supabase over HTTPS. This avoids requiring direct PostgreSQL network access from developer machines.

## Setup

1. Run [the Supabase migration](../database/migrations/001_gotogether_core.sql) in Supabase SQL Editor.
2. Copy `.env.example` to `.env`, then add your Supabase Project URL and server-only Secret/service-role key.
3. Install and run:

```sh
npm install
npm run dev
```

## Seed the itinerary catalogue

```sh
npm run seed:catalogue
```

The seed loads 72 structured itinerary records for future Travel DNA and AI matching.
