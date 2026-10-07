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

## Vercel frontend deployment

Deploy the React application using the Vite framework preset. Both supported Root Directory settings have checked-in configuration:

| Root Directory | Configuration | Build output |
| --- | --- | --- |
| `frontend` | `frontend/vercel.json` | `dist` |
| Repository root | `vercel.json` | `frontend/dist` |

These configurations build the frontend and serve `index.html` for application routes such as `/login`, `/travel-dna/new`, and `/quests/:roomId`. This lets React Router handle direct visits and page refreshes instead of Vercel returning `404 NOT_FOUND`. Deploy the application rather than the standalone landing-page file in `artifacts/`.

Set `VITE_API_URL` in Vercel to the deployed backend origin (without `/api`) before building. On the backend, set `FRONTEND_URL` and `APP_URL` to the public Vercel frontend origin. The Express API and database run separately; the frontend deployment does not start them. Redeploy after changing routing configuration or build-time environment variables.

Run `npm --prefix frontend run build` followed by `npm --prefix frontend run test:static-routes` to check landing-page navigation, direct links, and refreshes against the production files and both routing configurations. This local check does not contact a deployed backend.

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

Quest data, submitted preferences, private Companion conversations, and personalised itinerary notes live in the selected database. Drafts and saved places are scoped to the account in the current browser; they do not sync between devices. Places saved before signing in transfer to that account. Companion suggestions clearly show when AI is unavailable and a local fallback is used. Extracted preferences require review before being applied to the caller’s own answers. AI explanations and personal notes preserve the curated itinerary. See [AI setup and behavior](backend/README.md#companion-and-recommendation-behavior), including the required `004_ai_records.sql` migration before deployment.

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
