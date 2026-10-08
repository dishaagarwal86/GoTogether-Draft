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
| `/travel-dna/new` | Short trip idea, editable place/length/budget/pace, and inspiration cards; detailed setup at `?details=1` |
| `/workspace-preview` | Public interactive Kyoto sample; no account or API required; changes last until leaving |
| `/travel-dna/preferences` | Four-step preferences wizard with browser draft recovery |
| `/quests/:roomId` | Saved editable day canvas, drag/tap movement, inline replacement, locks, undo, and Ideas / private Companion / shared Crew panels |
| `/travel-dna/group-dna?roomId=…` | Travel DNA from submitted preferences, plus Companion |
| `/travel-dna/plan-paths?roomId=…` | Compare itineraries, read daily plans, optionally personalise with Companion |
| `/explore`, `/saved` | Filterable inspiration and a saved-place collection |
| `/invite/:token` | Invitation preview, account switching, explicit acceptance, and guest preferences |
| `/profile` | Authenticated name and country updates |
| `/travel-style` | Private scoped memories, editable past-trip reviews, and points/AI credits; history and perks also link from planning |

Quest data, submitted preferences, private Companion conversations, and personalised itinerary notes live in the selected database. Drafts and saved places are scoped to the account in the current browser; they do not sync between devices. Places saved before signing in transfer to that account. Companion suggestions clearly show when AI is unavailable and a local fallback is used. Extracted preferences require review before being applied to the caller’s own answers. AI explanations and personal notes preserve the curated itinerary. See [AI setup and behavior](backend/README.md#companion-and-recommendation-behavior), including the required `004_ai_records.sql` migration before deployment.

Signed-in travellers can also open the invitation bell in the navigation to view and accept pending quest invitations. The inbox checks for updates every 30 seconds and when opened, and works with either database provider. It uses the signed-in email address, so recipients can join even when invitation email delivery is unavailable.

### Editable trip workspace

Apply `database/migrations/007_quest_working_plans.sql`, `008_travel_memory_and_perks.sql`, `009_group_journey.sql`, and `010_solo_travel.sql` to the selected database before deploying this version of the backend. Keep the existing migrations, including the AI, guest, quest notes, and shortlist tables. The new table uses one row per quest with a revision and up to 30 undo snapshots. Its RLS is enabled; access goes through the authenticated backend with the server database role. No browser database credentials are needed.

`GET /api/working-plans/:roomId` returns the shared plan to accepted members. The quest host can choose a canonical recommendation with `POST /api/working-plans/:roomId` and submit validated commands to `POST /api/working-plans/:roomId/changes`. Commands include `expectedRevision` and a unique `requestId`; atomic compare-and-swap rejects stale writes, and known retries do not apply twice. Locks prevent edits, removal, and movement until unlocked. Undo persists across reloads. Members suggest changes through Crew; only the host edits the shared plan in this release. Legacy user and room endpoints now enforce session identity and quest membership as well.

The room now comes first. Quick start creates a room immediately, and both host and members confirm their own preferences inside it. Invite people with a reusable share link or an email invitation; email guests can submit preferences and respond to options before creating an account. The room shows real joined, invited, expired, and ready states. Saved ideas and crew chat work before an itinerary exists.

Matches appear only after every expected traveller confirms complete preferences. Incompatible fixed destinations, budget limits, no-go terms, or dates produce a recoverable conflict state. Members toggle **Best shared match**, **Fair compromise**, and **Alternative experience**, or browse all matching catalogue itineraries. Every option has a full day preview, personal fit, and trade-offs. Full catalogue browsing remains available in Explore; excluded itineraries cannot become the room's plan.

Each member responds **Love it**, **Works for me**, or **Concern**. Only the host can choose an option with current positive responses from everyone. Browsing options never changes the saved plan. Replacing the starting itinerary requires an explicit confirmation, respects locks, and retains undo history. Plan review applies to the exact saved revision and group preferences; subsequent edits or roster/preference changes require renewed review. Updates poll every six seconds. Room sections remain available throughout the flow: crew, comparison, itinerary, saved ideas, and chat.

Apply migration `009_group_journey.sql` before starting this API version, including on existing database volumes. It adds private response and share-link tables. The backend uses the server database role; browsers have no direct table policies. Rooms and saved itineraries are retained. Existing incomplete preferences need confirmation, and existing plans need a fresh group review. Group agreement does not validate bookings, transport feasibility, opening hours, or live prices.

**Solo travel:** Quick start and the room offer **Just me / With others**. A host-only room switches in place, preserving the saved itinerary, locks, undo history, personal ideas and notes; old generic join links are revoked. If anyone else has joined or has a pending invitation, choosing solo explains and creates an independent copy instead. The copy includes the host’s latest preferences, edited itinerary and personal picks, with fresh edit history. It excludes other travellers’ private preferences, shared conversation and votes. The original room and invitations stay intact. Solo travellers choose itineraries directly without voting; marking the current plan ready is a single action. Switching back to **With others** makes space for at least one additional traveller and restores group readiness and agreement requirements.

Apply `010_solo_travel.sql` after `009` before deploying this backend. Mode changes and shared-link joins use database transactions on both providers. UUID request receipts prevent duplicate copies after a lost response; shared joins recheck their capability while holding the room lock. Existing volumes need the new migration applied explicitly.

For the **Supabase dashboard**, open [the combined 009–010 script](database/manual/gotogether-production-009-010.sql) on GitHub, select **Raw**, and copy the entire file into **SQL Editor → New query** in the project connected to your backend. Click **Run**. The script checks prerequisite tables, applies both migrations in one transaction, refreshes the API schema, and verifies the new tables and functions. The final result includes `change_quest_mode(text,text,text,text)` and `join_quest_by_link(text,text)`. Earlier migrations must already be installed; this bundle does not replace them. If Render failed because these migrations were missing, retry its deployment after the SQL succeeds.

Manual changes remain trip-specific unless the traveller chooses **Remember this** in the optional inline nudge. The initial rules recognize changed morning starts, added interest categories, and removed hikes. Confirmed memories have a leisure/solo/partner/friends/family/work or all-trips scope. Undo cancels the source learning; the private Travel Style page supports explicit corrections, forgetting, reset, and pausing suggestions or future use. Quick start shows matching memories and offers a per-trip opt-out. Explicit trip answers override morning/pace/interest defaults; confirmed activities to avoid constrain matching until changed or memories are disabled. Saved plans are never retroactively rewritten.

Companion now has **Talk it through** and **Edit the plan** tabs. Edit requests create a durable before/after preview; only the host can apply it. Commands reuse the manual editor's locks, validation and revision checks, with one-step undo. A changed plan or changed preference context invalidates the preview. The deterministic fallback supports the displayed “Move unlocked moments one hour later” action only; other unsupported requests preserve the plan. Location, cost, transport feasibility and opening hours still require verification.

**Past chapters** accepts pasted text (up to 10,000 characters, 30 days, 1,500 characters per day) and turns Day headings into editable cards. Review drafts autosave after 600 ms; wait for the saved indicator before leaving. Review actual activities, add a reflection, and optionally confirm interests to remember. Imports and profiles remain private. Deleting an import removes its memories; minimal hash receipts remain to prevent repeated rewards.

The pilot grants 3 welcome planning credits; eligible self-reported completed trips earn 100 points for the first three rewarded contributions per calendar month. Redeem 100 points for 5 credits. A valid persisted AI edit preview costs 1 credit, whether or not applied; manual edits, ordinary chat, fallback output, and invalid generations are free. Duplicate destination/date or exact normalized content cannot earn twice. Known copies of the traveller's saved app plans can be stored but do not earn points. These checks do not prove travel or prevent all fabricated submissions. Credits and points have no cash value. Wallet locks and idempotent ledger keys protect concurrent requests; expired 90-second generation reservations are refunded on the next private action/profile read.

This is a confirmation-based personalization v1. PDF/image extraction, automatic personality inference, repeated-trip confidence/decay, advanced ranking evaluation, live booking validation, maps, and rewarded post-trip reviews of app-generated plans remain future work. The current 72-template catalogue limits initial plan variety. See [implementation scope and verification](docs/personalization-v1.md).

Run `npm run dev` and open `/workspace-preview` to try the sample. A signed-in quest requires the backend, migrations, and seeded catalogue. The interactive sample uses the same canvas component and needs none of those services.

For a separate local review environment, start the isolated fixtures and build the backend using the commands below, then run `npm --prefix frontend run dev:workspace`. It serves the UI on `http://127.0.0.1:5191` and the API on port 3017. Create a new local account to try saving and returning to quests. This environment uses test data; external AI and email are disabled, and stopping/removing the fixture database discards its data.

### Local browser verification

Use the isolated fixtures, which send no emails and make no external AI requests:

```bash
docker compose -f backend/tests/docker-compose.yml up -d --wait
npm --prefix backend run test:providers
npm run build
npm --prefix frontend run test:journey
```

To check a separately hosted API configuration using the same isolated fixtures, run `JOURNEY_DIRECT_API=1 npm --prefix frontend run test:journey`. This sets `VITE_API_URL` to the local test API and exercises cross-origin browser requests. Production frontend builds can set `VITE_API_URL` to the backend origin as shown in `frontend/.env.example`; the backend's `FRONTEND_URL` must allow the frontend origin.

The browser check requires Google Chrome (or set `PLAYWRIGHT_CHANNEL=chromium` after installing Playwright’s Chromium). Its runner starts temporary API/frontend processes on ports 3016/5186 against the test database on 55436, then stops those processes. It verifies sign-up, protected-route return, draft recovery, quest creation, chat persistence, preference edits, saved places, profile readback, missing quests, sign-in/sign-out, and responsive layouts. The group suite covers separate host/member/guest sessions, complete-group readiness, all itinerary previews, concerns, per-version agreement, live updates, and mobile navigation. The workspace suite covers pointer and tap movement, locks, inline editing, undo after reload, destination matching, private versus shared messages, failed-save retry, stale revision recovery, mobile panel focus, and reduced motion. The personalization suite covers inline memory choices, later-trip defaults, undo, reviewed AI fallback changes, autosaved imports, rewards, and 320-pixel layouts. The journey suite also covers existing detailed setup, AI fallback and reviewed preference extraction, guest invitations, and account flows. Screenshots and a JSON report are written to `frontend/.journey-test-results/` (ignored by Git). Synthetic records stay in the isolated test database until its containers are removed.
