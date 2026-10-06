# GoTogether

GoTogether is split into three clear areas so frontend, API, and database work stay independent.

```text
GoTogether-Draft/
├── frontend/                 React + Vite application
│   ├── src/
│   │   ├── components/       Reusable UI and global AppShell
│   │   ├── pages/            Route-level screens
│   │   ├── services/         Browser-side API and recommendation helpers
│   │   ├── data/             Mock data and UI content
│   │   └── css/              Feature styles
│   ├── public/               Static browser assets
│   └── package.json
├── backend/                  Express API and OpenAI integration
│   ├── src/routes/           HTTP endpoints
│   ├── src/services/         Database, auth, and Companion logic
│   ├── .env                  Local secrets — never commit this file
│   └── package.json
├── database/                 Database-owned files
│   ├── migrations/           SQL shared by PostgreSQL and Supabase
│   └── seeds/                Reusable catalogue seed scripts
└── package.json              Root shortcut commands
```

## First-time setup

```bash
npm --prefix frontend install
npm --prefix backend install
cp backend/.env.example backend/.env
```

Select a database provider in `backend/.env`: `DATABASE_PROVIDER=postgres` with `DATABASE_URL`, or `DATABASE_PROVIDER=supabase` with `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. Apply all SQL files in `database/migrations/` in numeric order to the chosen database. Docker Compose defaults to PostgreSQL and applies those migrations on the first database start. See [backend setup](backend/README.md) for provider selection and Docker overrides.

## Everyday commands

Run these from the repository root:

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the React frontend |
| `npm run dev:api` | Start the Express API |
| `npm run build` | Build frontend and backend |
| `npm run seed:catalogue` | Seed the itinerary catalogue using the selected provider |

The frontend normally runs at `http://localhost:5173`; it proxies `/api` requests to the backend at `http://127.0.0.1:3001`.

## Docker

From the repository root:

```bash
docker compose up --build
```

That starts PostgreSQL, applies `database/migrations/*.sql` to a new database volume, and connects the API with `DATABASE_URL`. Existing volumes need new migrations applied explicitly. The app is at `http://localhost:5173` and the API at `http://localhost:3001`. Local database credentials are `gotogether` / `gotogether` on database `gotogether`.

Docker builds use the public npm registry by default. If your network requires an approved npm mirror, build with `docker compose build --build-arg NPM_REGISTRY=https://your-mirror.example/npm/`, then run `docker compose up -d`. Keep TLS certificate verification enabled.

## Application journey

The app continues the landing page’s design across public browsing and the signed-in experience.

| Route | Purpose |
| --- | --- |
| `/login`, `/signup` | Account access; preserves the original quest or invitation destination |
| `/dashboard` | Personal overview, first-trip guidance, real quests, and inspiration |
| `/trips` | Hosting/joined quest collection with search; `/plan` redirects here |
| `/travel-dna/new` | Quest name, optional invitation, and destination inspiration |
| `/travel-dna/preferences` | Four-step preferences wizard with browser draft recovery |
| `/quests/:roomId` | Illustrated itinerary workspace with sticky desktop chat, a mobile chat sheet, contextual day discussions, and invitations |
| `/travel-dna/group-dna?roomId=…` | Travel DNA from submitted preferences, plus Companion |
| `/travel-dna/plan-paths?roomId=…` | Compare itineraries, read daily plans, optionally personalise with Companion |
| `/explore`, `/saved` | Filterable inspiration and a saved-place collection |
| `/invite/:token` | Invitation preview, account switching, explicit acceptance, and guest preferences |
| `/profile` | Authenticated name and country updates |

Quest data and submitted preferences live in the selected database. Drafts and saved places are scoped to the account in the current browser; they do not sync between devices. Places saved before signing in transfer to that account. Email delivery and live Companion personalisation require their existing provider configuration. The UI reports unavailable delivery or personalisation without blocking the saved quest or original itinerary.

Signed-in travellers can also open the invitation bell in the navigation to view and accept pending quest invitations. The inbox checks for updates every 30 seconds and when opened, and works with either database provider. It uses the signed-in email address, so recipients can join even when invitation email delivery is unavailable.

### Local browser verification

Use the isolated fixtures, which send no emails and make no external AI requests:

```bash
docker compose -f backend/tests/docker-compose.yml up -d --wait
npm --prefix backend run test:providers
npm run build
npm --prefix frontend run test:journey
```

To check a separately hosted API configuration using the same isolated fixtures, run `JOURNEY_DIRECT_API=1 npm --prefix frontend run test:journey`. This sets `VITE_API_URL` to the local test API and exercises cross-origin browser requests. Production frontend builds can set `VITE_API_URL` to the backend origin as shown in `frontend/.env.example`; the backend's `FRONTEND_URL` must allow the frontend origin.

The browser check requires Google Chrome (or set `PLAYWRIGHT_CHANNEL=chromium` after installing Playwright’s Chromium). Its runner starts temporary API/frontend processes on ports 3016/5186 against the test database on 55436, then stops those processes. It verifies sign-up, protected-route return, draft recovery, quest creation, chat persistence, preference edits, saved places, profile readback, missing quests, sign-in/sign-out, and responsive layouts. Workspace checks cover contextual day discussions, failed-send retries, unread messages, keyboard focus, sticky chat, and preserving the itinerary position and message draft when mobile chat closes. Screenshots and a JSON report are written to `frontend/.journey-test-results/` (ignored by Git). Synthetic records stay in the isolated test database until its containers are removed.
