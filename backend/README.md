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

The API listens on `0.0.0.0`, uses the host's `PORT` when set, and defaults to port 3001 for local development. Set `FRONTEND_URL` to the deployed frontend origin; comma-separated origins and the existing `CLIENT_ORIGIN` setting are supported. Set `APP_URL` to the public frontend URL used in invitations. `/health` and `/api/health` report process health; startup separately checks the selected database connection. For a separately hosted frontend, set `VITE_API_URL` to this backend's public origin at frontend build time, or provide a same-origin `/api` proxy. Leaving `VITE_API_URL` empty uses relative `/api` requests and the local Vite proxy.

## Render deployment

For a Render backend service rooted at `backend`, use this build command:

```sh
npm ci --include=dev && npm run build
```

The `&&` ensures Render stops if dependency installation fails. This project uses the public npm registry (`https://registry.npmjs.org/`) through `backend/.npmrc`; do not configure a private registry or proxy for deployment.

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

## Companion and recommendation behavior

The saved editor and travel-memory workflow also require migrations `007_quest_working_plans.sql` and `008_travel_memory_and_perks.sql`. Apply both before starting this backend version. See [personalization v1](../docs/personalization-v1.md) for the private APIs, database-role requirements, credit reservation policy, review workflow, and remaining limitations.

Apply [004_ai_records.sql](../database/migrations/004_ai_records.sql) before deploying this API version. It adds private AI history and shared rate-limit slots, with RLS enabled and no browser policies. Use the backend database role (or Supabase service role). Startup checks that both tables are accessible. Existing Docker volumes also need this migration applied explicitly.

Configure AI only on the backend:

| Setting | OpenAI | Ollama Cloud |
| --- | --- | --- |
| `AI_PROVIDER` | `openai` | `ollama` |
| API key | `OPENAI_API_KEY` | `OLLAMA_API_KEY` |
| Model override | `OPENAI_MODEL` (default `gpt-5-mini`) | `OLLAMA_MODEL` (default `gpt-oss:20b`) |
| Base URL | SDK default | `OLLAMA_BASE_URL` (default `https://ollama.com/v1`) |

Without an explicit provider, an Ollama key takes precedence, followed by OpenAI. Missing keys, invalid output, and provider failures produce a labelled local fallback. Docker forwards these variables; pass `--env-file backend/.env` when that file supplies them. Never put AI keys in Vercel frontend variables.

All Companion, personalised-story, and recommendation endpoints require a session bearer token. Quest operations also require accepted membership. Preference reads and writes are restricted to their owner. Model requests have a 15-second SDK timeout, an 18-second abort signal, no retries, a 2,500-token output cap, and server-side response validation. Each account gets ten generation attempts per fixed minute across API replicas; cached stories and history reads do not consume the quota.

- `POST /api/companion`: tasks `group-dna`, `extract`, `explain`, `chat`. Send `roomId` for quest tasks, `message` for extract/chat, `itineraryId` for explain, or `preferences` for a draft group-dna request. Context is assembled on the server.
- `GET /api/companion/history?roomId=…&task=…`: the caller’s last 50 saved results; explanations are filtered against current preferences.
- `POST /api/companion/:id/apply`: an explicit list of extracted `fields`. Updates only the caller’s preferences, checks for intervening edits, and refreshes UI recommendations. Other crew members’ preferences are never inferred or changed from pasted notes.
- `POST /api/personalise-itinerary`: accepts `roomId` and `itineraryId`; loads a currently eligible curated trip itself. Notes cannot structurally replace its itinerary. `GET` with the same query parameters restores saved notes. Preference changes invalidate the cached story; successful AI stories are reused, while fallback stories can be retried.

Private chat sends the last six Companion exchanges. Crew chat is excluded unless the user selects the checkbox, which includes up to 20 recent messages. Records remain private to the account and cascade on account/quest deletion. No AI message is posted to shared crew chat.

Recommendations remain deterministic catalogue matches. They preserve the strictest budget ceiling, the existing ±2-day duration tolerance for each member, and supported no-go phrase matches even when fewer than three trips qualify. Best shared match uses average fit; fair compromise maximises the lowest member fit among remaining options; unexpected match favours a different destination and interests. Scores are bounded to 0–100. No-go interpretation uses phrases and activity categories, not complete natural-language understanding. Curated prices/seasons are estimates, not live availability. The AI adds advice; it does not book trips or generate new catalogue entries.

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
