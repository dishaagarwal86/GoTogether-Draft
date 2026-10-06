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
