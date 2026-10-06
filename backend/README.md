# Go.Together API

The API supports two database providers through the same service interfaces:

| Provider | Configuration | Connection |
| --- | --- | --- |
| `postgres` | `DATABASE_PROVIDER=postgres`, `DATABASE_URL` | Direct PostgreSQL using `pg` |
| `supabase` | `DATABASE_PROVIDER=supabase`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Supabase Data API using the server-side SDK |

One provider is selected for the process. There is no connection-failure fallback or cross-provider data sync. An explicit provider ignores the other provider's settings. Without `DATABASE_PROVIDER`, a single configured provider is detected for backwards compatibility; configuring both requires an explicit choice. Restart the API after changing providers.

Supabase-hosted PostgreSQL can also use the direct `postgres` provider with its database or pooler connection URL. The `supabase` provider preserves the URL/service-role-key setup. Keep the service-role key in the backend environment; it must never be included in frontend configuration.

## Setup

1. Apply all SQL files in [database/migrations](../database/migrations) in numeric order to your PostgreSQL database or in the Supabase SQL Editor. They include the core schema, invitations, and chat messages. Local Docker Compose applies them on the first database start. For an existing database volume, apply new migrations explicitly; restarting Docker does not run them again.
2. Copy `.env.example` to `.env` and configure one provider as above. Both providers use the existing application-managed login/session model; this does not switch authentication to Supabase Auth.
3. Install and run:

```sh
npm install
npm run dev
```

## Seed the itinerary catalogue

```sh
npm run seed:catalogue
```

The seed loads 72 structured itinerary records using the selected provider. Existing catalogue IDs are left intact on repeated runs.

## Docker configuration

`docker compose up --build` defaults to the bundled PostgreSQL database. Compose reads overrides from your shell or a file passed with `--env-file`; it does not automatically load `backend/.env` for interpolation.

To run the backend against Supabase, set these in `backend/.env`:

```dotenv
DATABASE_PROVIDER=supabase
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-server-side-service-role-key
```

Then run from the repository root:

```sh
docker compose --env-file backend/.env up -d --build --no-deps backend
```

Use `--no-deps` to avoid starting the local database for Supabase mode. When selecting PostgreSQL in Docker, its connection URL must use a reachable database hostname such as `db`, rather than the container's own `localhost`.

## Provider checks

Run these from the repository root:

```sh
npm --prefix backend test
docker compose -f backend/tests/docker-compose.yml up -d --wait
npm --prefix backend run test:providers
docker compose -f backend/tests/docker-compose.yml down
```

The suite uses disposable PostgreSQL on `127.0.0.1:55436` and PostgREST on `127.0.0.1:55437`. The same contract exercises actual SQL and actual Supabase SDK HTTP requests: registration, login, session expiry/logout, room operations, invitation reissue/acceptance, memberships, chat access and persistence, JSON preferences, filtered entity CRUD, foreign keys, and idempotent catalogue seeding. SMTP is disabled during tests. No hosted Supabase or application database credentials are used. A hosted project's configuration and permissions still require verification in that environment.

Implementation references: [Supabase initialization](https://supabase.com/docs/reference/javascript/initializing), [returning inserted records](https://supabase.com/docs/reference/javascript/insert), [insert-only upserts](https://supabase.com/docs/reference/javascript/upsert), and [PostgreSQL parameterized queries](https://node-postgres.com/features/queries).
