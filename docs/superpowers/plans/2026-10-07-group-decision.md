# Group Decision Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Friends join a quest from a link with only a name, give four private quick answers, and get three ranked plans that show every person's fit. Anyone can type a change, and the quest is marked decided when everyone picks the same trip.

**Architecture:** Pure, unit-tested modules hold the rules: the vocabulary, scoring, keyword parsers, and tag derivation. Thin services read and write through the existing `storage.ts`, so Postgres and Supabase both work, and Express controllers sit on top. The AI only reads text (chat extraction, and typed changes when keywords find nothing). Fixed rules always do the ranking. The React front end adds a join page, a crew panel, and fit and vote controls inside the existing quest workspace.

**Tech Stack:** Node 22, Express 5, TypeScript 6, `node:test` with `tsx`, Postgres 16 or Supabase (PostgREST), React 19, React Router 7, Vite 8, Playwright for browser checks.

**Spec:** `docs/superpowers/specs/2026-10-06-group-decision-design.md`

## Global Constraints

- Feelings (up to three): `Adventure`, `Food & Culture`, `Relaxation`, `Nature`, `Nightlife`, `Wellness`.
- Pace (one): `Slow & relaxed`, `A balanced mix`, `Busy & activity-filled`.
- Budget band (one, private): `Budget-friendly`, `Moderate`, `Premium`, `Flexible`.
- No-gos (any, private): `hiking`, `water-activities`, `late-nights`, `early-starts`, `big-crowds`, `remote-places`, `lots-of-walking`.
- Minimum fit is `40`. A person's fit is `50 × mood + 30 × pace + 20 × note`. The group score is the geometric mean of fits, each floored at 1.
- Share-link tokens are 32 random bytes in hex, stored as a SHA-256 hash, and expire after 7 days. Guest names are 1–40 characters after trimming.
- The front end refreshes the crew panel and recommendations every 4 seconds.
- Reasons never mention a budget band or a no-go. Clash notes never name anyone. The crew status never includes anyone's band or no-gos. A member only ever receives their own chat suggestion.
- Services touch the database only through `backend/src/storage.ts`, never `pg` or the Supabase client directly. Migrations are the one exception.
- Every new integration suite runs on both providers through `backend/tests/run-provider-tests.mjs`.
- No new npm dependencies.
- User-facing text uses curly apostrophes (’), matching the existing UI.

**Test fixtures.** Start them once before running any integration test. Restart them with `down` whenever a migration changes:

```bash
docker compose -f backend/tests/docker-compose.yml down
docker compose -f backend/tests/docker-compose.yml up -d --wait
```

## Review Focus

1. **The same friend joins twice from a new phone.** The duplicate "Maya" has no answers, so they must not block the decision. Pinned in Task 10.
2. **Real WhatsApp exports.** iOS `[dd/mm/yyyy, hh:mm:ss] Name:`, Android `dd/mm/yyyy, hh:mm - Name:`, US `m/d/yy, h:mm PM - Name:`, system lines, `<Media omitted>`, and curly apostrophes must parse into the right people. Pinned in Task 8.
3. **AI returns junk.** Names that aren't in the chat, values outside the vocabularies, or no provider at all must be dropped or fall back to keywords. Pinned in Tasks 8 and 9.
4. **Limits rule out every trip.** The API returns no results plus `blockers`, and the workspace shows a notice instead of an empty or broken page. Pinned in Tasks 4, 5, and 13.
5. **Awkward guest names.** Whitespace-only and 41-character names are rejected. HTML-looking names are stored literally and never rendered as markup. Pinned in Task 6.

## Schedule (hackathon, 7–8 October)

- **7 October, morning:** Tasks 1–5. Plans are now ranked from real answers.
- **7 October, afternoon:** Tasks 6–10. The whole backend flow is working and tested.
- **7 October, evening:** Tasks 11–13. The front-end flow is working. Feature freeze at 21:00.
- **8 October, morning:** Tasks 14–15. Browser check, demo reset, Docker run, three rehearsals.

---

### Task 1: Migration 004 and migrations on start-up

**Files:**
- Create: `database/migrations/004_group_decision.sql`
- Create: `backend/src/migrations.ts`
- Create: `backend/tests/migrations.integration.test.ts`
- Create: `backend/tests/run-one.mjs`
- Modify: `backend/src/storage.ts` (the `tables` and `jsonColumns` constants)
- Modify: `backend/src/index.ts` (the start-up loop)
- Modify: `backend/tests/run-provider-tests.mjs` (the provider loop)
- Modify: `backend/package.json` (scripts)

**Interfaces:**
- Produces: `applyMigrations(directory?: string): Promise<string[]>`. It returns the applied file names in Postgres mode and `[]` in Supabase mode.
- Produces: the `storage.ts` tables `trip_room_links` and `trip_room_votes`, and the JSON columns `chat_suggestions`, `group_limits`, and `activity_tags`.
- Produces: `npm --prefix backend run test:one -- <file>`, which runs one test file against the Postgres fixture.
- Produces: the `crewSuites` array in `run-provider-tests.mjs`. Later tasks append their suites to it.

- [ ] **Step 1: Add the single-file test runner**

Create `backend/tests/run-one.mjs`:

```js
import { spawn } from 'node:child_process'

const [file] = process.argv.slice(2)
if (!file) {
  console.error('Usage: npm run test:one -- tests/<file>.test.ts')
  process.exit(1)
}
const env = { ...process.env, DATABASE_PROVIDER: 'postgres', DATABASE_URL: 'postgres://provider_test:provider_test@127.0.0.1:55436/gotogether_provider_test',
  SUPABASE_URL: '', SUPABASE_SERVICE_ROLE_KEY: '', OPENAI_API_KEY: '', OLLAMA_API_KEY: '', SMTP_HOST: '', SMTP_PORT: '', SMTP_USER: '', SMTP_PASS: '', SMTP_FROM: '',
  APP_URL: 'http://localhost:5173', DOTENV_CONFIG_PATH: '/dev/null', NODE_ENV: 'test' }
const child = spawn(process.execPath, ['--import', 'tsx', '--test', file], { env, stdio: 'inherit' })
child.on('exit', (code) => { process.exitCode = code ?? 1 })
```

In `backend/package.json`, replace:

```json
    "test:providers": "node tests/run-provider-tests.mjs"
```

with:

```json
    "test:providers": "node tests/run-provider-tests.mjs",
    "test:one": "node tests/run-one.mjs"
```

- [ ] **Step 2: Write the failing test**

Create `backend/tests/migrations.integration.test.ts`:

```ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { applyMigrations } from '../src/migrations.js'
import { query } from '../src/db.js'
import { closeDatabase, selectRows } from '../src/storage.js'

test(`group decision schema is available (${process.env.DATABASE_PROVIDER})`, async () => {
  assert.equal(process.env.NODE_ENV, 'test')
  try {
    assert.deepEqual(await selectRows('trip_room_links', ['id'], [{ column: 'id', operator: 'eq', value: 'missing' }]), [])
    assert.deepEqual(await selectRows('trip_room_votes', ['trip_room_id'], [{ column: 'trip_room_id', operator: 'eq', value: 'missing' }]), [])
    const applied = await applyMigrations()
    if (process.env.DATABASE_PROVIDER !== 'postgres') {
      assert.deepEqual(applied, [])
      return
    }
    assert.ok(applied.includes('004_group_decision.sql'))
    assert.deepEqual(await applyMigrations(), applied, 'migrations are idempotent')
    const columns = await query(`select column_name from information_schema.columns where table_schema = 'public'
      and column_name in ('chat_suggestions', 'group_limits', 'decided_itinerary_id', 'decided_at', 'is_guest', 'activity_tags')`)
    assert.equal(columns.rowCount, 6)
  } finally {
    await closeDatabase()
  }
})
```

- [ ] **Step 3: Run the test to confirm it fails**

Run: `npm --prefix backend run test:one -- tests/migrations.integration.test.ts`

Expected: FAIL with `Cannot find module '../src/migrations.js'` or `Unsupported database table.`

- [ ] **Step 4: Write the migration**

Create `database/migrations/004_group_decision.sql`:

```sql
-- Run after 001–003. Every statement is safe to run more than once.
create table if not exists public.trip_room_links (
  id text primary key,
  trip_room_id text not null references public.trip_rooms(id) on delete cascade,
  token_hash text not null unique,
  created_by text not null references public.users(id) on delete cascade,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists trip_room_links_room_idx on public.trip_room_links(trip_room_id);

create table if not exists public.trip_room_votes (
  trip_room_id text not null references public.trip_rooms(id) on delete cascade,
  user_id text not null references public.users(id) on delete cascade,
  itinerary_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (trip_room_id, user_id)
);

alter table public.trip_rooms add column if not exists chat_suggestions jsonb;
alter table public.trip_rooms add column if not exists group_limits jsonb not null default '{}'::jsonb;
alter table public.trip_rooms add column if not exists decided_itinerary_id text;
alter table public.trip_rooms add column if not exists decided_at timestamptz;
alter table public.users add column if not exists is_guest boolean not null default false;
alter table public.itinerary_catalogue add column if not exists activity_tags jsonb not null default '[]'::jsonb;
```

- [ ] **Step 5: Write the migration runner**

Create `backend/src/migrations.ts`:

```ts
import { readdir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { getDatabaseConfig } from './databaseConfig.js'
import { getPool } from './db.js'

const defaultDirectory = fileURLToPath(new URL('../../database/migrations/', import.meta.url))

// Supabase schemas are changed in its SQL editor, so only local Postgres is migrated here.
export async function applyMigrations(directory = defaultDirectory): Promise<string[]> {
  if (getDatabaseConfig().provider !== 'postgres') return []
  const files = (await readdir(directory)).filter((file) => file.endsWith('.sql')).sort()
  const client = await getPool().connect()
  try {
    for (const file of files) {
      const sql = await readFile(`${directory}${file}`, 'utf8')
      await client.query('begin')
      try {
        await client.query(sql)
        await client.query('commit')
      } catch (error) {
        await client.query('rollback')
        throw new Error(`Migration ${file} failed: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
  } finally {
    client.release()
  }
  return files
}
```

- [ ] **Step 6: Register the new tables and JSON columns**

In `backend/src/storage.ts`, replace:

```ts
const tables = ['users', 'user_sessions', 'preferences', 'contacts', 'itineraries', 'flights', 'hotels', 'activities', 'suggested_itineraries', 'country_itineraries', 'itinerary_catalogue', 'trip_rooms', 'trip_room_people', 'trip_room_invites', 'trip_room_messages'] as const
```

with:

```ts
const tables = ['users', 'user_sessions', 'preferences', 'contacts', 'itineraries', 'flights', 'hotels', 'activities', 'suggested_itineraries', 'country_itineraries', 'itinerary_catalogue', 'trip_rooms', 'trip_room_people', 'trip_room_invites', 'trip_room_messages', 'trip_room_links', 'trip_room_votes'] as const
```

and replace:

```ts
const jsonColumns = new Set(['data', 'dates', 'location_preferences', 'mood_preferences', 'activities_must_have', 'activities_preferred', 'accommodation_preferences', 'seasons', 'moods', 'daily_plan', 'ai_context'])
```

with:

```ts
const jsonColumns = new Set(['data', 'dates', 'location_preferences', 'mood_preferences', 'activities_must_have', 'activities_preferred', 'accommodation_preferences', 'seasons', 'moods', 'daily_plan', 'ai_context', 'chat_suggestions', 'group_limits', 'activity_tags'])
```

- [ ] **Step 7: Apply migrations on start-up**

In `backend/src/index.ts`, replace:

```ts
import { verifyDatabaseConnection } from './storage.js'
```

with:

```ts
import { verifyDatabaseConnection } from './storage.js'
import { applyMigrations } from './migrations.js'
```

and replace:

```ts
      await verifyDatabaseConnection()
      app.listen(port, '0.0.0.0', () => {
```

with:

```ts
      const applied = await applyMigrations()
      if (applied.length) console.log(`Checked ${applied.length} database migrations.`)
      await verifyDatabaseConnection()
      app.listen(port, '0.0.0.0', () => {
```

- [ ] **Step 8: Add the suite to the provider runner**

In `backend/tests/run-provider-tests.mjs`, replace:

```js
  for (const provider of ['postgres', 'supabase']) {
    console.log(`\nProvider contract: ${provider}`)
    await run(provider, ['--import', 'tsx', '--test', 'tests/providers.integration.test.ts'])
    await run(provider, ['--import', 'tsx', '../database/seeds/seedItineraryCatalogue.ts'])
    await run(provider, ['--import', 'tsx', '../database/seeds/seedItineraryCatalogue.ts'])
    await run(provider, ['--import', 'tsx', '--test', 'tests/catalogue.integration.test.ts'])
  }
```

with:

```js
  const crewSuites = []
  for (const provider of ['postgres', 'supabase']) {
    console.log(`\nProvider contract: ${provider}`)
    await run(provider, ['--import', 'tsx', '--test', 'tests/migrations.integration.test.ts'])
    await run(provider, ['--import', 'tsx', '--test', 'tests/providers.integration.test.ts'])
    await run(provider, ['--import', 'tsx', '../database/seeds/seedItineraryCatalogue.ts'])
    await run(provider, ['--import', 'tsx', '../database/seeds/seedItineraryCatalogue.ts'])
    await run(provider, ['--import', 'tsx', '--test', 'tests/catalogue.integration.test.ts'])
    for (const suite of crewSuites) await run(provider, ['--import', 'tsx', '--test', suite])
  }
```

- [ ] **Step 9: Run the tests to confirm they pass**

Restart the fixtures with `down`, then `up -d --wait`, so `004` is applied.

Run: `npm --prefix backend run test:one -- tests/migrations.integration.test.ts`
Expected: PASS

Run: `npm --prefix backend run test:providers`
Expected: PASS for both `postgres` and `supabase`.

- [ ] **Step 10: Commit**

```bash
git add database/migrations/004_group_decision.sql backend/src/migrations.ts backend/src/storage.ts backend/src/index.ts backend/tests/migrations.integration.test.ts backend/tests/run-one.mjs backend/tests/run-provider-tests.mjs backend/package.json
git commit -m "feat: add group decision schema and apply migrations on start-up"
```

---

### Task 2: Crew vocabulary and answer normalisation

**Files:**
- Create: `backend/src/services/crewVocabulary.ts`
- Create: `backend/tests/crewVocabulary.test.ts`
- Modify: `backend/package.json` (the `test` script)

**Interfaces:**
- Produces:
  - Constants: `FEELINGS`, `PACES`, `BUDGET_BANDS`, `NO_GOS`, `NO_GO_LABELS`, `NO_GO_KEYWORDS`.
  - Types: `Feeling`, `Pace`, `BudgetBand`, `NoGo`, `MemberAnswers = { feelings: Feeling[]; pace: Pace | null; budgetBand: BudgetBand | null; noGo: NoGo[]; note: string }`.
  - Functions: `normaliseFeelings(unknown): Feeling[]`, `normalisePace(unknown): Pace | null`, `normaliseBand(unknown): BudgetBand | null`, `normaliseNoGo(unknown): NoGo[]`, `normaliseAnswers(unknown): MemberAnswers`, `noGoTagsFromText(string): NoGo[]`, `answersFromPreference(row): MemberAnswers`, `hasAnswers(MemberAnswers): boolean`, `emptyAnswers(): MemberAnswers`, `budgetRank(BudgetBand | null): number`, `tripBudgetRank(string): number`.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/crewVocabulary.test.ts`:

```ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { answersFromPreference, budgetRank, emptyAnswers, hasAnswers, noGoTagsFromText, normaliseAnswers, normaliseFeelings, tripBudgetRank } from '../src/services/crewVocabulary.js'

test('feelings from the long questionnaire map onto catalogue moods', () => {
  assert.deepEqual(normaliseFeelings(['Food & local culture', 'History', 'Shopping', 'Wellness', 'Nature']), ['Food & Culture', 'Wellness', 'Nature'])
  assert.deepEqual(normaliseFeelings('Nature'), [])
})

test('answers keep only known values', () => {
  assert.deepEqual(normaliseAnswers({ feelings: ['Relaxation'], pace: 'Slow & relaxed', budgetBand: 'Lux', noGo: ['hiking', 'flying'], note: '  sunsets ' }),
    { feelings: ['Relaxation'], pace: 'Slow & relaxed', budgetBand: null, noGo: ['hiking'], note: 'sunsets' })
  assert.deepEqual(normaliseAnswers('junk'), emptyAnswers())
  assert.equal(hasAnswers(emptyAnswers()), false)
  assert.equal(hasAnswers({ ...emptyAnswers(), budgetBand: 'Moderate' }), true)
})

test('free-text no-gos become tags, including health limits', () => {
  assert.deepEqual(noGoTagsFromText('No long hikes, my knee hurts. Hate crowded places'), ['hiking', 'big-crowds', 'lots-of-walking'])
  assert.deepEqual(noGoTagsFromText('no hiking please'), ['hiking'])
  assert.deepEqual(noGoTagsFromText(''), [])
})

test('questionnaire rows and quick-answer rows both read back as answers', () => {
  assert.deepEqual(answersFromPreference({ mood_preferences: ['Nature'], budget: 'Moderate', activities_must_have: 'street food', data: { pace: 'A balanced mix', noGo: 'early mornings please no' } }),
    { feelings: ['Nature'], pace: 'A balanced mix', budgetBand: 'Moderate', noGo: ['early-starts'], note: 'street food' })
  assert.deepEqual(answersFromPreference({ mood_preferences: [], budget: null, data: { noGoTags: ['big-crowds'], noGo: 'hiking', note: 'a quiet beach' } }),
    { feelings: [], pace: null, budgetBand: null, noGo: ['big-crowds'], note: 'a quiet beach' })
})

test('budget ranks treat Flexible and missing as no limit', () => {
  assert.equal(budgetRank('Budget-friendly'), 0)
  assert.equal(budgetRank('Premium'), 2)
  assert.equal(budgetRank('Flexible'), Number.POSITIVE_INFINITY)
  assert.equal(budgetRank(null), Number.POSITIVE_INFINITY)
  assert.equal(tripBudgetRank('Moderate'), 1)
})
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `(cd backend && node --import tsx --test tests/crewVocabulary.test.ts)`
Expected: FAIL with `Cannot find module '../src/services/crewVocabulary.js'`.

- [ ] **Step 3: Write the vocabulary module**

Create `backend/src/services/crewVocabulary.ts`:

```ts
export const FEELINGS = ['Adventure', 'Food & Culture', 'Relaxation', 'Nature', 'Nightlife', 'Wellness'] as const
export const PACES = ['Slow & relaxed', 'A balanced mix', 'Busy & activity-filled'] as const
export const BUDGET_BANDS = ['Budget-friendly', 'Moderate', 'Premium', 'Flexible'] as const
export const NO_GOS = ['hiking', 'water-activities', 'late-nights', 'early-starts', 'big-crowds', 'remote-places', 'lots-of-walking'] as const

export type Feeling = typeof FEELINGS[number]
export type Pace = typeof PACES[number]
export type BudgetBand = typeof BUDGET_BANDS[number]
export type NoGo = typeof NO_GOS[number]
export type MemberAnswers = { feelings: Feeling[]; pace: Pace | null; budgetBand: BudgetBand | null; noGo: NoGo[]; note: string }

export const NO_GO_LABELS: Record<NoGo, string> = {
  hiking: 'Hiking', 'water-activities': 'Water activities', 'late-nights': 'Late nights', 'early-starts': 'Early starts',
  'big-crowds': 'Big crowds', 'remote-places': 'Remote places', 'lots-of-walking': 'Lots of walking',
}

export const NO_GO_KEYWORDS: Record<NoGo, string[]> = {
  hiking: ['hike', 'hiking', 'trek', 'climb'],
  'water-activities': ['swim', 'water', 'boat', 'snorkel', 'surf', 'diving'],
  'late-nights': ['late night', 'clubbing', 'party', 'nightlife'],
  'early-starts': ['early start', 'early morning', 'sunrise', 'wake up early'],
  'big-crowds': ['crowd', 'touristy'],
  'remote-places': ['remote', 'middle of nowhere', 'long drive', 'long travel'],
  'lots-of-walking': ['walk', 'on my feet', 'knee', 'mobility', 'wheelchair'],
}

const FEELING_ALIASES: Record<string, Feeling> = {
  adventure: 'Adventure', 'food & culture': 'Food & Culture', 'food & local culture': 'Food & Culture', 'food and culture': 'Food & Culture',
  history: 'Food & Culture', relaxation: 'Relaxation', nature: 'Nature', nightlife: 'Nightlife', wellness: 'Wellness',
}

const list = (value: unknown): unknown[] => Array.isArray(value) ? value : []
const text = (value: unknown) => typeof value === 'string' ? value.trim() : ''

export function emptyAnswers(): MemberAnswers {
  return { feelings: [], pace: null, budgetBand: null, noGo: [], note: '' }
}

export function normaliseFeelings(values: unknown): Feeling[] {
  const found = list(values).map((value) => FEELING_ALIASES[text(value).toLowerCase()]).filter((value): value is Feeling => Boolean(value))
  return [...new Set(found)].slice(0, 3)
}

export function normalisePace(value: unknown): Pace | null {
  return PACES.find((pace) => pace === text(value)) ?? null
}

export function normaliseBand(value: unknown): BudgetBand | null {
  return BUDGET_BANDS.find((band) => band === text(value)) ?? null
}

export function normaliseNoGo(values: unknown): NoGo[] {
  const chosen = new Set(list(values).map(text))
  return NO_GOS.filter((tag) => chosen.has(tag))
}

export function normaliseAnswers(input: unknown): MemberAnswers {
  const source = input && typeof input === 'object' ? input as Record<string, unknown> : {}
  return { feelings: normaliseFeelings(source.feelings), pace: normalisePace(source.pace), budgetBand: normaliseBand(source.budgetBand), noGo: normaliseNoGo(source.noGo), note: text(source.note).slice(0, 280) }
}

export function noGoTagsFromText(value: string): NoGo[] {
  const lower = value.toLowerCase()
  return NO_GOS.filter((tag) => NO_GO_KEYWORDS[tag].some((keyword) => lower.includes(keyword)))
}

export function answersFromPreference(row: { mood_preferences?: unknown; budget?: unknown; activities_must_have?: unknown; data?: unknown }): MemberAnswers {
  const data = row.data && typeof row.data === 'object' ? row.data as Record<string, unknown> : {}
  const noGo = Array.isArray(data.noGoTags) ? normaliseNoGo(data.noGoTags) : noGoTagsFromText(text(data.noGo))
  return { feelings: normaliseFeelings(row.mood_preferences), pace: normalisePace(data.pace), budgetBand: normaliseBand(row.budget), noGo, note: text(data.note ?? row.activities_must_have).slice(0, 280) }
}

export function hasAnswers(answers: MemberAnswers) {
  return answers.feelings.length > 0 || answers.pace !== null || answers.budgetBand !== null || answers.noGo.length > 0
}

export function budgetRank(band: BudgetBand | null): number {
  return band === 'Budget-friendly' ? 0 : band === 'Moderate' ? 1 : band === 'Premium' ? 2 : Number.POSITIVE_INFINITY
}

export function tripBudgetRank(value: string): number {
  return value === 'Budget-friendly' ? 0 : value === 'Premium' ? 2 : 1
}
```

- [ ] **Step 4: Add the suite to the unit test script**

In `backend/package.json`, replace:

```json
    "test": "node --import tsx --test tests/databaseConfig.test.ts",
```

with:

```json
    "test": "node --import tsx --test tests/databaseConfig.test.ts tests/crewVocabulary.test.ts",
```

- [ ] **Step 5: Run the tests to confirm they pass**

Run: `npm --prefix backend test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/src/services/crewVocabulary.ts backend/tests/crewVocabulary.test.ts backend/package.json
git commit -m "feat: add crew vocabulary and answer normalisation"
```

---

### Task 3: Catalogue activity tags and seeding on start-up

**Files:**
- Create: `backend/src/services/catalogueSeed.ts`
- Create: `backend/tests/catalogueSeed.test.ts`
- Modify: `database/seeds/seedItineraryCatalogue.ts` (replace the whole file)
- Modify: `backend/tests/catalogue.integration.test.ts`
- Modify: `backend/src/index.ts`
- Modify: `backend/package.json` (the `test` script)

**Interfaces:**
- Consumes: `NO_GOS` and `NoGo` from Task 2; `insertIfMissing`, `selectRows`, and `updateRows` from `storage.ts`.
- Produces:
  - `deriveActivityTags(place: { location: string; anchors: string[] }, moods: string[], pace: string): NoGo[]`
  - `catalogueRows(): CatalogueSeedRow[]`
  - `seedCatalogue(): Promise<{ inserted: number; tagged: number }>`

- [ ] **Step 1: Write the failing test**

Create `backend/tests/catalogueSeed.test.ts`:

```ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { catalogueRows, deriveActivityTags } from '../src/services/catalogueSeed.js'

test('activity tags follow the spec rules', () => {
  assert.deepEqual(deriveActivityTags({ location: 'Mountains', anchors: ['alpine railways', 'lake swims', 'mountain trails'] }, ['Relaxation', 'Nightlife'], 'Slow & relaxed'),
    ['hiking', 'water-activities', 'late-nights', 'lots-of-walking'])
  assert.deepEqual(deriveActivityTags({ location: 'City', anchors: ['tea houses', 'lantern lanes', 'forest shrines'] }, ['Food & Culture', 'Nature'], 'Busy & activity-filled'),
    ['early-starts', 'big-crowds', 'lots-of-walking'])
  assert.deepEqual(deriveActivityTags({ location: 'Hidden gems', anchors: ['valley hikes', 'cave stays', 'sunrise balloons'] }, ['Adventure', 'Relaxation'], 'A balanced mix'),
    ['hiking', 'early-starts', 'remote-places', 'lots-of-walking'])
  assert.deepEqual(deriveActivityTags({ location: 'Countryside', anchors: ['backwaters', 'spice gardens', 'Ayurvedic rituals'] }, ['Wellness', 'Food & Culture'], 'Slow & relaxed'), [])
})

test('the catalogue has 72 unique trips, each with tags', () => {
  const rows = catalogueRows()
  assert.equal(rows.length, 72)
  assert.equal(new Set(rows.map((row) => row.id)).size, 72)
  assert.ok(rows.every((row) => Array.isArray(row.activity_tags)))
  assert.ok(rows.some((row) => row.activity_tags.includes('hiking')))
  assert.ok(rows.some((row) => !row.activity_tags.includes('hiking') && !row.activity_tags.includes('lots-of-walking')))
})
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `(cd backend && node --import tsx --test tests/catalogueSeed.test.ts)`
Expected: FAIL with `Cannot find module '../src/services/catalogueSeed.js'`.

- [ ] **Step 3: Move the seed into a module with tag derivation**

Create `backend/src/services/catalogueSeed.ts`:

```ts
import { insertIfMissing, selectRows, updateRows } from '../storage.js'
import { NO_GOS, type NoGo } from './crewVocabulary.js'

type SeedPlace = { destination: string; country: string; location: string; seasons: string[]; anchors: string[] }
export type CatalogueSeedRow = Record<string, unknown> & { id: string; activity_tags: NoGo[] }

const places: SeedPlace[] = [
  { destination: 'Santorini', country: 'Greece', location: 'Islands', seasons: ['Spring', 'Summer', 'Autumn'], anchors: ['caldera walks', 'volcanic beaches', 'sunset tavernas'] },
  { destination: 'Bali', country: 'Indonesia', location: 'Beach', seasons: ['Spring', 'Summer', 'Autumn'], anchors: ['rice terraces', 'temple rituals', 'surf breaks'] },
  { destination: 'Amalfi Coast', country: 'Italy', location: 'Beach', seasons: ['Spring', 'Summer', 'Autumn'], anchors: ['coastal paths', 'lemon groves', 'family trattorias'] },
  { destination: 'Kyoto', country: 'Japan', location: 'City', seasons: ['Spring', 'Autumn', 'Winter'], anchors: ['tea houses', 'lantern lanes', 'forest shrines'] },
  { destination: 'Interlaken', country: 'Switzerland', location: 'Mountains', seasons: ['Summer', 'Autumn', 'Winter'], anchors: ['alpine railways', 'lake swims', 'mountain trails'] },
  { destination: 'Marrakech', country: 'Morocco', location: 'City', seasons: ['Spring', 'Autumn', 'Winter'], anchors: ['souks', 'rooftop dinners', 'desert gateways'] },
  { destination: 'Barcelona', country: 'Spain', location: 'City', seasons: ['Spring', 'Summer', 'Autumn'], anchors: ['modernist streets', 'market tapas', 'city beaches'] },
  { destination: 'Cappadocia', country: 'Türkiye', location: 'Hidden gems', seasons: ['Spring', 'Summer', 'Autumn'], anchors: ['valley hikes', 'cave stays', 'sunrise balloons'] },
  { destination: 'Kerala', country: 'India', location: 'Countryside', seasons: ['Winter', 'Spring', 'Autumn'], anchors: ['backwaters', 'spice gardens', 'Ayurvedic rituals'] },
  { destination: 'Reykjavík', country: 'Iceland', location: 'Hidden gems', seasons: ['Winter', 'Spring', 'Summer'], anchors: ['hot springs', 'waterfalls', 'northern skies'] },
  { destination: 'Queenstown', country: 'New Zealand', location: 'Mountains', seasons: ['Spring', 'Summer', 'Autumn'], anchors: ['adventure rivers', 'vineyard lunches', 'ridge walks'] },
  { destination: 'Tulum', country: 'Mexico', location: 'Beach', seasons: ['Winter', 'Spring', 'Autumn'], anchors: ['cenotes', 'Mayan ruins', 'jungle dinners'] },
  { destination: 'Hoi An', country: 'Vietnam', location: 'Countryside', seasons: ['Spring', 'Summer', 'Winter'], anchors: ['lantern workshops', 'river markets', 'cooking gardens'] },
  { destination: 'Cape Town', country: 'South Africa', location: 'City', seasons: ['Spring', 'Summer', 'Autumn'], anchors: ['table mountain', 'wine valleys', 'penguin beaches'] },
  { destination: 'Madeira', country: 'Portugal', location: 'Islands', seasons: ['Spring', 'Summer', 'Autumn'], anchors: ['levada trails', 'clifftop pools', 'vineyard villages'] },
  { destination: 'Banff', country: 'Canada', location: 'Mountains', seasons: ['Summer', 'Autumn', 'Winter'], anchors: ['turquoise lakes', 'glacier trails', 'fireside lodges'] },
  { destination: 'Zanzibar', country: 'Tanzania', location: 'Islands', seasons: ['Winter', 'Summer', 'Autumn'], anchors: ['spice farms', 'sailing dhows', 'reef swims'] },
  { destination: 'Oaxaca', country: 'Mexico', location: 'Hidden gems', seasons: ['Spring', 'Autumn', 'Winter'], anchors: ['mole kitchens', 'artisan villages', 'mountain ruins'] },
  { destination: 'Edinburgh', country: 'Scotland', location: 'City', seasons: ['Spring', 'Summer', 'Autumn'], anchors: ['castle lanes', 'whisky bars', 'literary walks'] },
  { destination: 'Luang Prabang', country: 'Laos', location: 'Countryside', seasons: ['Winter', 'Spring', 'Autumn'], anchors: ['mekong mornings', 'temple alms', 'waterfall pools'] },
  { destination: 'Palawan', country: 'Philippines', location: 'Islands', seasons: ['Winter', 'Spring', 'Summer'], anchors: ['limestone lagoons', 'island hopping', 'reef coves'] },
  { destination: 'Patagonia', country: 'Chile', location: 'Mountains', seasons: ['Spring', 'Summer', 'Autumn'], anchors: ['granite trails', 'glacier views', 'remote estancias'] },
  { destination: 'Ubud', country: 'Indonesia', location: 'Countryside', seasons: ['Spring', 'Summer', 'Autumn'], anchors: ['yoga shalas', 'rice fields', 'craft studios'] },
  { destination: 'Valletta', country: 'Malta', location: 'Hidden gems', seasons: ['Spring', 'Summer', 'Autumn'], anchors: ['harbour swims', 'baroque streets', 'island ferries'] },
]
const moods = ['Adventure', 'Food & Culture', 'Relaxation', 'Nature', 'Nightlife', 'Wellness']
const budgets = ['Budget-friendly', 'Moderate', 'Premium'] as const
const titles: Record<string, string> = { Adventure: 'Wild horizons & brave detours', 'Food & Culture': 'Local tables & living stories', Relaxation: 'Slow mornings & golden hours', Nature: 'Open skies & untamed trails', Nightlife: 'After-dark flavours & city rhythm', Wellness: 'Restore, roam & reconnect' }

const mentions = (anchors: string[], words: string[]) => anchors.some((anchor) => words.some((word) => anchor.toLowerCase().includes(word)))

export function deriveActivityTags(place: { location: string; anchors: string[] }, tripMoods: string[], pace: string): NoGo[] {
  const tags = new Set<NoGo>()
  if (place.location === 'Mountains' || mentions(place.anchors, ['trail', 'hike', 'walk', 'ridge']) || tripMoods[0] === 'Adventure') tags.add('hiking')
  if (place.location === 'Beach' || place.location === 'Islands' || mentions(place.anchors, ['swim', 'surf', 'reef', 'lagoon', 'sailing', 'boat', 'pool'])) tags.add('water-activities')
  if (tripMoods.includes('Nightlife')) tags.add('late-nights')
  if (mentions(place.anchors, ['sunrise', 'morning', 'alms', 'balloon']) || pace === 'Busy & activity-filled') tags.add('early-starts')
  if (place.location === 'City') tags.add('big-crowds')
  if (place.location === 'Hidden gems' || mentions(place.anchors, ['remote'])) tags.add('remote-places')
  if (tags.has('hiking') || mentions(place.anchors, ['walk', 'lanes', 'streets', 'paths', 'ruins'])) tags.add('lots-of-walking')
  return NO_GOS.filter((tag) => tags.has(tag))
}

export function catalogueRows(): CatalogueSeedRow[] {
  return Array.from({ length: 72 }, (_, index) => {
    const place = places[index % places.length]
    const mood = moods[index % moods.length]
    const budget = budgets[Math.floor(index / moods.length) % budgets.length]
    const duration = 3 + (index % 4)
    const cost = budget === 'Budget-friendly' ? 420 + (index % 5) * 45 : budget === 'Moderate' ? 900 + (index % 5) * 90 : 1750 + (index % 5) * 180
    const pace = index % 3 === 0 ? 'Slow & relaxed' : index % 3 === 1 ? 'A balanced mix' : 'Busy & activity-filled'
    const tripMoods = [mood, moods[(index + 2) % moods.length]]
    const dailyPlan = Array.from({ length: duration }, (_, day) => ({ day: day + 1, morning: `${place.anchors[day % 3]} at an easy pace`, afternoon: mood === 'Food & Culture' ? 'Meet a local maker and taste regional favourites' : `A curated ${mood.toLowerCase()} experience`, evening: day === duration - 1 ? 'A celebratory final dinner' : 'A relaxed neighbourhood evening' }))
    const aiContext = { primaryMood: mood, secondaryMoods: [tripMoods[1]], groupFit: index % 5 === 0 ? ['Families', 'Friends'] : ['Couples', 'Friends'], pace, highlights: place.anchors, avoidIf: mood === 'Adventure' ? ['Limited mobility'] : ['None'] }
    return {
      id: `catalogue_${String(index + 1).padStart(3, '0')}`, title: `${place.destination} · ${titles[mood]}`, destination: place.destination, country: place.country,
      duration_days: duration, budget, estimated_cost_usd: cost, seasons: place.seasons, moods: tripMoods, location_type: place.location,
      short_description: `${duration} days shaped around ${place.anchors.join(', ')}.`,
      why_it_fits: `Best for groups seeking ${mood.toLowerCase()} with a ${budget.toLowerCase()} comfort level.`,
      daily_plan: dailyPlan, ai_context: aiContext, activity_tags: deriveActivityTags(place, tripMoods, pace),
    }
  })
}

// Insert-only: reruns never overwrite edited trips; they only add missing trips and missing tags.
export async function seedCatalogue() {
  const rows = catalogueRows()
  const existing = await selectRows<{ id: string; activity_tags: unknown }>('itinerary_catalogue', ['id', 'activity_tags'], [{ column: 'id', operator: 'in', value: rows.map((row) => row.id) }])
  const stored = new Map(existing.map((row) => [row.id, row.activity_tags]))
  let inserted = 0
  let tagged = 0
  for (const row of rows) {
    const tags = stored.get(row.id)
    if (!stored.has(row.id)) {
      await insertIfMissing('itinerary_catalogue', row)
      inserted++
    } else if (!Array.isArray(tags) || tags.length === 0) {
      if (!row.activity_tags.length) continue
      await updateRows('itinerary_catalogue', { activity_tags: row.activity_tags }, [{ column: 'id', operator: 'eq', value: row.id }], ['id'])
      tagged++
    }
  }
  return { inserted, tagged }
}
```

- [ ] **Step 4: Point the seed script at the module**

Replace the whole of `database/seeds/seedItineraryCatalogue.ts` with:

```ts
import '../../backend/src/environment.js'
import { closeDatabase } from '../../backend/src/storage.js'
import { seedCatalogue } from '../../backend/src/services/catalogueSeed.js'

seedCatalogue()
  .then(({ inserted, tagged }) => console.log(`Catalogue ready: ${inserted} trips added, ${tagged} trips tagged.`))
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'Catalogue seed failed.')
    process.exitCode = 1
  })
  .finally(() => closeDatabase())
```

- [ ] **Step 5: Assert tags in the catalogue integration test**

In `backend/tests/catalogue.integration.test.ts`, replace:

```ts
    const rows = await selectRows('itinerary_catalogue', ['id', 'daily_plan', 'moods', 'seasons'])
```

with:

```ts
    const rows = await selectRows('itinerary_catalogue', ['id', 'daily_plan', 'moods', 'seasons', 'activity_tags'])
    assert.ok(rows.every((row) => Array.isArray(row.activity_tags)))
    assert.ok(rows.some((row) => (row.activity_tags as string[]).includes('hiking')))
```

- [ ] **Step 6: Seed on every start-up**

In `backend/src/index.ts`, replace:

```ts
import { applyMigrations } from './migrations.js'
```

with:

```ts
import { applyMigrations } from './migrations.js'
import { seedCatalogue } from './services/catalogueSeed.js'
```

and replace:

```ts
      await verifyDatabaseConnection()
      app.listen(port, '0.0.0.0', () => {
```

with:

```ts
      await verifyDatabaseConnection()
      await seedCatalogue()
        .then(({ inserted, tagged }) => { if (inserted || tagged) console.log(`Catalogue ready: ${inserted} trips added, ${tagged} trips tagged.`) })
        .catch((error: unknown) => console.error('Catalogue seeding failed; recommendations may be empty.', error))
      app.listen(port, '0.0.0.0', () => {
```

- [ ] **Step 7: Add the unit suite**

In `backend/package.json`, replace:

```json
    "test": "node --import tsx --test tests/databaseConfig.test.ts tests/crewVocabulary.test.ts",
```

with:

```json
    "test": "node --import tsx --test tests/databaseConfig.test.ts tests/crewVocabulary.test.ts tests/catalogueSeed.test.ts",
```

- [ ] **Step 8: Run the tests to confirm they pass**

Run: `npm --prefix backend test`
Expected: PASS

Run: `npm --prefix backend run test:providers`
Expected: PASS. The catalogue suite still reports exactly 72 trips, now with tags.

- [ ] **Step 9: Commit**

```bash
git add backend/src/services/catalogueSeed.ts backend/tests/catalogueSeed.test.ts database/seeds/seedItineraryCatalogue.ts backend/tests/catalogue.integration.test.ts backend/src/index.ts backend/package.json
git commit -m "feat: tag catalogue trips and seed them on start-up"
```

---

### Task 4: Group scoring

**Files:**
- Create: `backend/src/services/groupScoring.ts`
- Create: `backend/tests/groupScoring.test.ts`
- Modify: `backend/package.json` (the `test` script)

**Interfaces:**
- Consumes: from Task 2, `FEELINGS`, `PACES`, `budgetRank`, `tripBudgetRank`, `MemberAnswers`, `BudgetBand`, `NoGo`, and `Pace`.
- Produces:
  - Types:
    - `CatalogueTrip`
    - `ScoringMember = { userId; name; answers: MemberAnswers }`
    - `GroupLimits = { budgetBand?: BudgetBand | null; noGo?: NoGo[] }`
    - `MemberFit = { userId; name; fit; reason }`
    - `ScoredTrip = CatalogueTrip & { groupScore; minFit; members: MemberFit[]; matchedFeelings: string[] }`
    - `PathLabel`
    - `GroupPath = ScoredTrip & { label: PathLabel; stretch: boolean }`
    - `Blocker = 'budget' | 'no-go'`
    - `GroupResult = { paths; ranked; clashes; blockers }`
  - Constant: `MINIMUM_FIT = 40`.
  - Functions: `memberFit(trip, answers)`, `reasonFor(answers, matched, paceMatch)`, `blockedBy(trip, members, limits)`, `geometricMean(values)`, `clashNotes(members)`, `effectiveBudgetBand(members, limits)`, `scoreTrip(trip, members)`, `scoreGroup({ members, limits, catalogue })`.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/groupScoring.test.ts`:

```ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { blockedBy, clashNotes, effectiveBudgetBand, geometricMean, memberFit, scoreGroup, type CatalogueTrip, type ScoringMember } from '../src/services/groupScoring.js'
import { emptyAnswers, type MemberAnswers } from '../src/services/crewVocabulary.js'

const trip = (id: string, overrides: Partial<CatalogueTrip> = {}): CatalogueTrip => ({
  id, title: id, destination: id, country: 'Testland', duration_days: 4, budget: 'Moderate', estimated_cost_usd: 900, seasons: ['Spring'],
  moods: ['Relaxation', 'Wellness'], location_type: 'Beach', short_description: '4 days shaped around beaches.', why_it_fits: '', daily_plan: [],
  ai_context: { pace: 'Slow & relaxed', highlights: ['quiet beach'] }, activity_tags: [], ...overrides,
})
const member = (name: string, answers: Partial<MemberAnswers>): ScoringMember => ({ userId: `user_${name}`, name, answers: { ...emptyAnswers(), ...answers } })
const PRIVATE_WORDS = /budget|moderate|premium|flexible|hiking|walking|crowd|late night|early start|remote|water/i

test('a person’s fit combines mood, pace, and note', () => {
  const maya = member('Maya', { feelings: ['Relaxation', 'Wellness'], pace: 'Slow & relaxed', note: 'quiet beach' })
  assert.deepEqual(memberFit(trip('t1'), maya.answers), { fit: 100, matched: ['Relaxation', 'Wellness'], paceMatch: true })
  assert.equal(memberFit(trip('t1'), emptyAnswers()).fit, 58)
  assert.equal(memberFit(trip('t1', { ai_context: { pace: 'Busy & activity-filled', highlights: [] } }), maya.answers).fit, 70, 'opposite pace scores 0; “beach” still matches the description')
})

test('hard limits remove trips above anyone’s budget or with anyone’s no-go', () => {
  const careful = member('Maya', { budgetBand: 'Moderate', noGo: ['hiking'] })
  assert.equal(blockedBy(trip('p', { budget: 'Premium' }), [careful], {}), 'budget')
  assert.equal(blockedBy(trip('p', { budget: 'Premium' }), [member('Rohan', { budgetBand: 'Flexible' })], {}), null)
  assert.equal(blockedBy(trip('h', { activity_tags: ['hiking'] }), [careful], {}), 'no-go')
  assert.equal(blockedBy(trip('c', { activity_tags: ['big-crowds'] }), [member('Ana', {})], { noGo: ['big-crowds'] }), 'no-go')
  assert.equal(blockedBy(trip('m'), [careful], { budgetBand: 'Budget-friendly' }), 'budget')
})

test('the group score multiplies fits so nobody is ignored', () => {
  assert.equal(geometricMean([100, 25]), 50)
  assert.equal(geometricMean([0, 100]), 10)
  assert.equal(geometricMean([]), 0)
})

test('three different paths: best group score, fairest, and a hidden gem', () => {
  const members = [member('Alex', { feelings: ['Adventure', 'Nature'], pace: 'Busy & activity-filled', note: 'rafting' }), member('Sam', { feelings: ['Relaxation', 'Nature'], pace: 'Slow & relaxed' })]
  const catalogue = [
    trip('trip-1', { moods: ['Adventure', 'Nature'], location_type: 'Mountains', ai_context: { pace: 'A balanced mix', highlights: ['rafting'] } }),
    trip('trip-2', { moods: ['Nature', 'Relaxation'], location_type: 'Countryside', ai_context: { pace: 'A balanced mix', highlights: [] } }),
    trip('trip-3', { moods: ['Nature'], location_type: 'Countryside', ai_context: { pace: 'A balanced mix', highlights: ['rafting'] } }),
    trip('trip-4', { moods: ['Nature', 'Wellness'], location_type: 'Hidden gems', ai_context: { pace: 'A balanced mix', highlights: ['rafting'] } }),
    trip('trip-5', { moods: ['Nightlife', 'Food & Culture'], location_type: 'City', ai_context: { pace: 'Busy & activity-filled', highlights: [] } }),
  ]
  const result = scoreGroup({ members, limits: {}, catalogue })
  assert.deepEqual(result.paths.map((path) => path.label), ['Best shared fit', 'Fair compromise', 'Unexpected discovery'])
  assert.equal(new Set(result.paths.map((path) => path.id)).size, 3)
  assert.equal(result.paths[0].id, 'trip-1')
  const rest = result.ranked.filter((item) => item.id !== result.paths[0].id)
  assert.equal(result.paths[1].minFit, Math.max(...rest.map((item) => item.minFit)))
  assert.equal(result.paths[2].location_type, 'Hidden gems')
  assert.ok(result.paths.every((path) => !path.stretch && path.minFit >= 40))
  assert.ok(!result.ranked.some((item) => item.id === 'trip-5'), 'trips leaving someone below 40 are not offered')
  assert.ok(result.paths.every((path) => path.members.length === 2))
})

test('when nothing is comfortable for everyone, the closest trips are marked stretch', () => {
  const members = [member('Alex', { feelings: ['Adventure'], pace: 'Busy & activity-filled' }), member('Sam', { feelings: ['Relaxation'], pace: 'Slow & relaxed' })]
  const catalogue = [trip('a', { moods: ['Adventure', 'Nightlife'], ai_context: { pace: 'Busy & activity-filled', highlights: [] } }), trip('b', { moods: ['Relaxation', 'Wellness'] })]
  const result = scoreGroup({ members, limits: {}, catalogue })
  assert.equal(result.paths.length, 2)
  assert.ok(result.paths.every((path) => path.stretch))
})

test('when limits rule out every trip, blockers explain why without names', () => {
  const tight = scoreGroup({ members: [member('Maya', { budgetBand: 'Budget-friendly' })], limits: {}, catalogue: [trip('p', { budget: 'Premium' })] })
  assert.deepEqual(tight.paths, [])
  assert.deepEqual(tight.blockers, ['budget'])
  const noHikes = scoreGroup({ members: [member('Maya', { noGo: ['hiking'] })], limits: {}, catalogue: [trip('h', { activity_tags: ['hiking'] })] })
  assert.deepEqual(noHikes.blockers, ['no-go'])
  assert.deepEqual(scoreGroup({ members: [], limits: {}, catalogue: [trip('x')] }), { paths: [], ranked: [], clashes: [], blockers: [] })
})

test('reasons never reveal a budget band or a no-go', () => {
  const members = [member('Maya', { feelings: ['Relaxation'], budgetBand: 'Moderate', noGo: ['hiking', 'lots-of-walking'] }), member('Rohan', { pace: 'A balanced mix', budgetBand: 'Premium' })]
  const result = scoreGroup({ members, limits: {}, catalogue: [trip('t1'), trip('t2', { moods: ['Nature'], ai_context: { pace: 'A balanced mix', highlights: [] } }), trip('t3', { moods: ['Adventure'] })] })
  for (const path of result.paths) for (const fit of path.members) assert.doesNotMatch(fit.reason, PRIVATE_WORDS)
})

test('clash notes are anonymous and need at least two people', () => {
  const notes = clashNotes([member('Maya', { feelings: ['Relaxation'], pace: 'Slow & relaxed', budgetBand: 'Budget-friendly' }), member('Rohan', { feelings: ['Adventure'], pace: 'Busy & activity-filled', budgetBand: 'Premium' })])
  assert.deepEqual(notes, [
    'Budgets vary a lot — every plan stays within the tightest one.',
    'Some want slow days and some want busy ones — plans balance both.',
    'No shared trip feeling yet — the unexpected pick is worth a look.',
  ])
  assert.ok(notes.every((note) => !/Maya|Rohan/.test(note)))
  assert.deepEqual(clashNotes([member('Solo', { pace: 'Slow & relaxed' })]), [])
})

test('the effective budget band is the tightest one', () => {
  assert.equal(effectiveBudgetBand([member('A', { budgetBand: 'Premium' }), member('B', { budgetBand: 'Moderate' })], {}), 'Moderate')
  assert.equal(effectiveBudgetBand([member('A', { budgetBand: 'Flexible' })], {}), null)
  assert.equal(effectiveBudgetBand([member('A', { budgetBand: 'Premium' })], { budgetBand: 'Budget-friendly' }), 'Budget-friendly')
})
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `(cd backend && node --import tsx --test tests/groupScoring.test.ts)`
Expected: FAIL with `Cannot find module '../src/services/groupScoring.js'`.

- [ ] **Step 3: Write the scoring module**

Create `backend/src/services/groupScoring.ts`:

```ts
import { FEELINGS, PACES, budgetRank, tripBudgetRank, type BudgetBand, type MemberAnswers, type NoGo, type Pace } from './crewVocabulary.js'

export type CatalogueTrip = {
  id: string; title: string; destination: string; country: string; duration_days: number; budget: string; estimated_cost_usd: number
  seasons: string[]; moods: string[]; location_type: string; short_description: string; why_it_fits: string; daily_plan: unknown
  ai_context: { pace?: string; highlights?: string[] } | null; activity_tags: string[] | null
}
export type ScoringMember = { userId: string; name: string; answers: MemberAnswers }
export type GroupLimits = { budgetBand?: BudgetBand | null; noGo?: NoGo[] }
export type MemberFit = { userId: string; name: string; fit: number; reason: string }
export type ScoredTrip = CatalogueTrip & { groupScore: number; minFit: number; members: MemberFit[]; matchedFeelings: string[] }
export type PathLabel = 'Best shared fit' | 'Fair compromise' | 'Unexpected discovery'
export type GroupPath = ScoredTrip & { label: PathLabel; stretch: boolean }
export type Blocker = 'budget' | 'no-go'
export type GroupResult = { paths: GroupPath[]; ranked: ScoredTrip[]; clashes: string[]; blockers: Blocker[] }

export const MINIMUM_FIT = 40
const STOP_WORDS = new Set(['days', 'with', 'want', 'would', 'like', 'some', 'that', 'this', 'have', 'time', 'trip', 'around', 'shaped', 'really', 'just', 'please', 'love', 'near', 'from', 'into', 'more'])
const PACE_WORDS: Record<Pace, string> = { 'Slow & relaxed': 'slow', 'A balanced mix': 'balanced', 'Busy & activity-filled': 'busy' }

function paceScore(member: Pace | null, tripPace: string | undefined) {
  const tripIndex = PACES.findIndex((pace) => pace === tripPace)
  if (!member || tripIndex < 0) return 0.6
  return [1, 0.5, 0][Math.abs(PACES.indexOf(member) - tripIndex)]
}

function noteScore(note: string, trip: CatalogueTrip) {
  const words = note.toLowerCase().split(/[^a-z]+/).filter((word) => word.length >= 4 && !STOP_WORDS.has(word))
  if (!words.length) return 0.5
  const haystack = `${(trip.ai_context?.highlights ?? []).join(' ')} ${trip.short_description}`.toLowerCase()
  return words.some((word) => haystack.includes(word)) ? 1 : 0
}

const joinNames = (values: string[]) => values.length <= 1 ? values.join('') : `${values.slice(0, -1).join(', ')} and ${values.at(-1)}`

export function memberFit(trip: CatalogueTrip, answers: MemberAnswers) {
  const matched = answers.feelings.filter((feeling) => trip.moods.includes(feeling))
  const mood = answers.feelings.length ? matched.length / answers.feelings.length : 0.6
  const fit = Math.round(50 * mood + 30 * paceScore(answers.pace, trip.ai_context?.pace) + 20 * noteScore(answers.note, trip))
  return { fit, matched, paceMatch: answers.pace !== null && answers.pace === trip.ai_context?.pace }
}

export function reasonFor(answers: MemberAnswers, matched: string[], paceMatch: boolean) {
  if (matched.length && paceMatch && answers.pace) return `${joinNames(matched)}, at a ${PACE_WORDS[answers.pace]} pace`
  if (matched.length) return joinNames(matched)
  if (paceMatch && answers.pace) return `Right pace: ${answers.pace.toLowerCase()}`
  return 'Not their top pick, but nothing on their no-go list'
}

export function blockedBy(trip: CatalogueTrip, members: ScoringMember[], limits: GroupLimits): Blocker | null {
  const bands = [...members.map((member) => member.answers.budgetBand), limits.budgetBand ?? null]
  if (bands.some((band) => tripBudgetRank(trip.budget) > budgetRank(band))) return 'budget'
  const tags = new Set(trip.activity_tags ?? [])
  const noGos = [...members.flatMap((member) => member.answers.noGo), ...(limits.noGo ?? [])]
  return noGos.some((tag) => tags.has(tag)) ? 'no-go' : null
}

export function geometricMean(values: number[]) {
  if (!values.length) return 0
  return Math.round(Math.exp(values.reduce((sum, value) => sum + Math.log(Math.max(1, value)), 0) / values.length))
}

export function effectiveBudgetBand(members: ScoringMember[], limits: GroupLimits): BudgetBand | null {
  const rank = Math.min(...[...members.map((member) => member.answers.budgetBand), limits.budgetBand ?? null].map(budgetRank))
  return rank === 0 ? 'Budget-friendly' : rank === 1 ? 'Moderate' : rank === 2 ? 'Premium' : null
}

export function clashNotes(members: ScoringMember[]): string[] {
  if (members.length < 2) return []
  const notes: string[] = []
  const ranks = members.map((member) => budgetRank(member.answers.budgetBand)).filter(Number.isFinite)
  if (ranks.length >= 2 && Math.max(...ranks) - Math.min(...ranks) >= 2) notes.push('Budgets vary a lot — every plan stays within the tightest one.')
  const paces = new Set(members.map((member) => member.answers.pace))
  if (paces.has('Slow & relaxed') && paces.has('Busy & activity-filled')) notes.push('Some want slow days and some want busy ones — plans balance both.')
  const withFeelings = members.filter((member) => member.answers.feelings.length)
  const shared = FEELINGS.some((feeling) => withFeelings.filter((member) => member.answers.feelings.includes(feeling)).length >= 2)
  if (withFeelings.length >= 2 && !shared) notes.push('No shared trip feeling yet — the unexpected pick is worth a look.')
  return notes
}

export function scoreTrip(trip: CatalogueTrip, members: ScoringMember[]): ScoredTrip {
  const fits = members.map((member) => ({ member, ...memberFit(trip, member.answers) }))
  return {
    ...trip,
    groupScore: geometricMean(fits.map((item) => item.fit)),
    minFit: Math.min(...fits.map((item) => item.fit)),
    members: fits.map((item) => ({ userId: item.member.userId, name: item.member.name, fit: item.fit, reason: reasonFor(item.member.answers, item.matched, item.paceMatch) })),
    matchedFeelings: [...new Set(fits.flatMap((item) => item.matched))],
  }
}

const byGroup = (a: ScoredTrip, b: ScoredTrip) => b.groupScore - a.groupScore || b.minFit - a.minFit || a.id.localeCompare(b.id)
const byFairness = (a: ScoredTrip, b: ScoredTrip) => b.minFit - a.minFit || b.groupScore - a.groupScore || a.id.localeCompare(b.id)

export function scoreGroup(input: { members: ScoringMember[]; limits: GroupLimits; catalogue: CatalogueTrip[] }): GroupResult {
  const { members, limits, catalogue } = input
  if (!members.length) return { paths: [], ranked: [], clashes: [], blockers: [] }
  const clashes = clashNotes(members)
  const allowed = catalogue.filter((trip) => blockedBy(trip, members, limits) === null)
  if (!allowed.length) {
    const blockers = [...new Set(catalogue.map((trip) => blockedBy(trip, members, limits)).filter((reason): reason is Blocker => reason !== null))]
    return { paths: [], ranked: [], clashes, blockers }
  }
  const scored = allowed.map((trip) => scoreTrip(trip, members)).sort(byGroup)
  const comfortable = scored.filter((trip) => trip.minFit >= MINIMUM_FIT)
  const stretch = comfortable.length === 0
  const pool = stretch ? scored : comfortable
  const [best, ...rest] = pool
  const fair = [...rest].sort(byFairness)[0]
  const remaining = rest.filter((trip) => trip.id !== fair?.id)
  const unexpected = remaining.find((trip) => trip.location_type === 'Hidden gems') ?? remaining[0]
  const picks: Array<[ScoredTrip | undefined, PathLabel]> = [[best, 'Best shared fit'], [fair, 'Fair compromise'], [unexpected, 'Unexpected discovery']]
  const paths = picks.flatMap(([trip, label]) => trip ? [{ ...trip, label, stretch }] : [])
  return { paths, ranked: pool.slice(0, 12), clashes, blockers: [] }
}
```

- [ ] **Step 4: Add the unit suite**

In `backend/package.json`, replace:

```json
    "test": "node --import tsx --test tests/databaseConfig.test.ts tests/crewVocabulary.test.ts tests/catalogueSeed.test.ts",
```

with:

```json
    "test": "node --import tsx --test tests/databaseConfig.test.ts tests/crewVocabulary.test.ts tests/catalogueSeed.test.ts tests/groupScoring.test.ts",
```

- [ ] **Step 5: Run the tests to confirm they pass**

Run: `npm --prefix backend test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/src/services/groupScoring.ts backend/tests/groupScoring.test.ts backend/package.json
git commit -m "feat: score trips per person with hard limits and fair paths"
```

---

### Task 5: Recommendations from real members, behind membership

**Files:**
- Create: `backend/src/services/crewErrors.ts`
- Create: `backend/src/services/membership.ts`
- Create: `backend/src/middleware/access.ts`
- Create: `backend/tests/crewFixtures.ts`
- Create: `backend/tests/recommendations.integration.test.ts`
- Modify: `backend/src/services/recommendationService.ts` (replace the whole file)
- Modify: `backend/src/routes/recommendations.ts` (replace the whole file)
- Modify: `backend/tests/run-provider-tests.mjs` (`crewSuites`)

**Interfaces:**
- Consumes: Tasks 2–4. `userForToken` and `PublicUser` from `authService.ts`.
- Produces:
  - `class CrewError(status: 400 | 403 | 404 | 422, message)`
  - `memberRole(roomId, userId): Promise<'owner' | 'member' | undefined>`
  - `acceptedMembers(roomId): Promise<AcceptedMember[]>`, where `AcceptedMember = { userId; role; name; firstName; isGuest }`
  - `optionalUser(request)`
  - `requireMember(request, response): Promise<{ user; role; roomId } | undefined>`
  - `sendError(response, next, error)`
  - `loadScoringMembers(roomId)`, `loadGroupLimits(roomId)`, `loadCatalogue()`
  - `recommendForQuest(roomId)`, with the same signature as before and new fields
  - `lowestFitFor(roomId, itineraryId)`
  - Test helpers: `createCrewFixture()`, `cleanupCrewFixture(fixture)`, `startApi()`

- [ ] **Step 1: Write the shared test fixture**

Create `backend/tests/crewFixtures.ts`:

```ts
import { randomUUID } from 'node:crypto'
import type { AddressInfo } from 'node:net'
import { app } from '../src/app.js'
import { registerUser } from '../src/services/authService.js'
import { createRoom } from '../src/services/roomService.js'
import { seedCatalogue } from '../src/services/catalogueSeed.js'
import { deleteRows } from '../src/storage.js'

export type CrewFixture = Awaited<ReturnType<typeof createCrewFixture>>

export async function createCrewFixture() {
  await seedCatalogue()
  const suffix = randomUUID()
  const owner = await registerUser({ firstName: 'Alex', lastName: 'Organiser', email: `crew-owner-${suffix}@example.invalid`, password: 'Synthetic crew password 2026!' })
  const room = await createRoom({ name: 'Crew test quest', tripName: 'Somewhere good', members: 3, ownerId: owner.user.id })
  return { suffix, owner, roomId: room.id, userIds: [owner.user.id] }
}

export async function cleanupCrewFixture(fixture: { roomId: string; userIds: string[] }) {
  await deleteRows('trip_rooms', [{ column: 'id', operator: 'eq', value: fixture.roomId }])
  await deleteRows('users', [{ column: 'id', operator: 'in', value: fixture.userIds }])
}

export async function startApi() {
  const server = app.listen(0, '127.0.0.1')
  await new Promise<void>((resolve) => server.once('listening', () => resolve()))
  const { port } = server.address() as AddressInfo
  return { base: `http://127.0.0.1:${port}/api`, close: () => new Promise<void>((resolve) => server.close(() => resolve())) }
}
```

- [ ] **Step 2: Write the failing test**

Create `backend/tests/recommendations.integration.test.ts`:

```ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { registerUser } from '../src/services/authService.js'
import { recommendForQuest } from '../src/services/recommendationService.js'
import { NO_GOS } from '../src/services/crewVocabulary.js'
import { closeDatabase, insertRow, updateRows } from '../src/storage.js'
import { cleanupCrewFixture, createCrewFixture, startApi } from './crewFixtures.js'

test(`recommendations rank real members' answers (${process.env.DATABASE_PROVIDER})`, async (t) => {
  const fixture = await createCrewFixture()
  const api = await startApi()
  try {
    await insertRow('preferences', { id: `preference_${fixture.suffix}`, user_id: fixture.owner.user.id, trip_room_id: fixture.roomId, budget: 'Moderate', mood_preferences: ['Relaxation', 'Wellness'], data: { pace: 'Slow & relaxed', noGoTags: ['hiking'], note: '', source: 'quick' } }, ['id'])

    await t.test('three labelled paths respect the budget and no-gos', async () => {
      const result = await recommendForQuest(fixture.roomId)
      assert.equal(result.memberCount, 1)
      assert.deepEqual(result.results.map((trip) => trip.label), ['Best shared fit', 'Fair compromise', 'Unexpected discovery'])
      for (const trip of result.results) {
        assert.notEqual(trip.budget, 'Premium')
        assert.ok(!(trip.activity_tags ?? []).includes('hiking'))
        assert.equal(trip.members[0].userId, fixture.owner.user.id)
        assert.equal(trip.score, trip.groupScore)
        assert.doesNotMatch(trip.members[0].reason, /budget|moderate|hiking/i)
      }
      assert.equal(result.travelDna?.budgetStyle, 'Moderate')
    })

    await t.test('limits that rule out every trip return blockers instead of results', async () => {
      await updateRows('trip_rooms', { group_limits: { budgetBand: 'Budget-friendly', noGo: [...NO_GOS] } }, [{ column: 'id', operator: 'eq', value: fixture.roomId }], ['id'])
      const blocked = await recommendForQuest(fixture.roomId)
      assert.deepEqual(blocked.results, [])
      assert.ok(blocked.blockers.length > 0)
      await updateRows('trip_rooms', { group_limits: {} }, [{ column: 'id', operator: 'eq', value: fixture.roomId }], ['id'])
    })

    await t.test('the HTTP route is for members only', async () => {
      const url = `${api.base}/recommendations/quests/${fixture.roomId}`
      assert.equal((await fetch(url)).status, 401)
      const outsider = await registerUser({ firstName: 'Out', lastName: 'Sider', email: `outsider-${fixture.suffix}@example.invalid`, password: 'Synthetic crew password 2026!' })
      fixture.userIds.push(outsider.user.id)
      assert.equal((await fetch(url, { headers: { Authorization: `Bearer ${outsider.token}` } })).status, 403)
      const allowed = await fetch(url, { headers: { Authorization: `Bearer ${fixture.owner.token}` } })
      assert.equal(allowed.status, 200)
      assert.equal(((await allowed.json()) as { data: { results: unknown[] } }).data.results.length, 3)
    })
  } finally {
    await api.close()
    await cleanupCrewFixture(fixture)
    await closeDatabase()
  }
})
```

- [ ] **Step 3: Run the test to confirm it fails**

Run: `npm --prefix backend run test:one -- tests/recommendations.integration.test.ts`
Expected: FAIL. The labels are still `Best shared match`, and `trip.members` is undefined.

- [ ] **Step 4: Write the error type, membership, and access helpers**

Create `backend/src/services/crewErrors.ts`:

```ts
export class CrewError extends Error {
  constructor(readonly status: 400 | 403 | 404 | 422, message: string) {
    super(message)
  }
}
```

Create `backend/src/services/membership.ts`:

```ts
import { selectRows } from '../storage.js'

export type RoomRole = 'owner' | 'member'
export type AcceptedMember = { userId: string; role: RoomRole; name: string; firstName: string; isGuest: boolean }

export async function memberRole(roomId: string, userId: string): Promise<RoomRole | undefined> {
  const [row] = await selectRows<{ role: string }>('trip_room_people', ['role'], [
    { column: 'trip_room_id', operator: 'eq', value: roomId },
    { column: 'user_id', operator: 'eq', value: userId },
    { column: 'invite_status', operator: 'eq', value: 'accepted' },
  ])
  if (!row) return undefined
  return row.role === 'owner' ? 'owner' : 'member'
}

export async function acceptedMembers(roomId: string): Promise<AcceptedMember[]> {
  const memberships = await selectRows<{ user_id: string; role: string }>('trip_room_people', ['user_id', 'role'], [
    { column: 'trip_room_id', operator: 'eq', value: roomId },
    { column: 'invite_status', operator: 'eq', value: 'accepted' },
  ], { orderBy: 'created_at', ascending: true })
  if (!memberships.length) return []
  const users = await selectRows<{ id: string; first_name: string | null; last_name: string | null; is_guest: boolean | null }>('users', ['id', 'first_name', 'last_name', 'is_guest'],
    [{ column: 'id', operator: 'in', value: memberships.map((row) => row.user_id) }])
  const byId = new Map(users.map((user) => [user.id, user]))
  return memberships.flatMap((row) => {
    const user = byId.get(row.user_id)
    if (!user) return []
    const firstName = user.first_name?.trim() || 'Traveller'
    return [{ userId: row.user_id, role: row.role === 'owner' ? 'owner' as const : 'member' as const, name: `${firstName} ${user.last_name ?? ''}`.trim(), firstName, isGuest: Boolean(user.is_guest) }]
  })
}
```

Create `backend/src/middleware/access.ts`:

```ts
import type { NextFunction, Request, Response } from 'express'
import { userForToken, type PublicUser } from '../services/authService.js'
import { memberRole, type RoomRole } from '../services/membership.js'
import { CrewError } from '../services/crewErrors.js'
import { routeParam } from '../routes/helpers.js'

export function bearerToken(request: Request) {
  const header = request.header('authorization')
  return header?.startsWith('Bearer ') ? header.slice(7) : ''
}

export async function optionalUser(request: Request): Promise<PublicUser | undefined> {
  const token = bearerToken(request)
  return token ? userForToken(token) : undefined
}

export async function requireMember(request: Request, response: Response): Promise<{ user: PublicUser; role: RoomRole; roomId: string } | undefined> {
  const user = await optionalUser(request)
  if (!user) {
    response.status(401).json({ error: 'Please sign in to open this quest.' })
    return undefined
  }
  const roomId = routeParam(request, 'roomId')
  const role = await memberRole(roomId, user.id)
  if (!role) {
    response.status(403).json({ error: 'Only members of this quest can do that.' })
    return undefined
  }
  return { user, role, roomId }
}

export function sendError(response: Response, next: NextFunction, error: unknown) {
  if (error instanceof CrewError) return response.status(error.status).json({ error: error.message })
  return next(error)
}
```

- [ ] **Step 5: Rewrite the recommendation service on top of scoring**

Replace the whole of `backend/src/services/recommendationService.ts` with:

```ts
import { selectRows } from '../storage.js'
import { acceptedMembers } from './membership.js'
import { FEELINGS, NO_GO_LABELS, answersFromPreference, hasAnswers, normaliseBand, normaliseNoGo, type Feeling } from './crewVocabulary.js'
import { effectiveBudgetBand, memberFit, scoreGroup, type CatalogueTrip, type GroupLimits, type ScoringMember } from './groupScoring.js'

type PreferenceRow = { user_id: string; budget: string | null; mood_preferences: unknown; activities_must_have: string | null; data: unknown; updated_at: string | Date }
const catalogueColumns = ['id', 'title', 'destination', 'country', 'duration_days', 'budget', 'estimated_cost_usd', 'seasons', 'moods', 'location_type', 'short_description', 'why_it_fits', 'daily_plan', 'ai_context', 'activity_tags']

export async function loadScoringMembers(roomId: string): Promise<ScoringMember[]> {
  const [members, preferences] = await Promise.all([
    acceptedMembers(roomId),
    selectRows<PreferenceRow>('preferences', ['user_id', 'budget', 'mood_preferences', 'activities_must_have', 'data', 'updated_at'], [{ column: 'trip_room_id', operator: 'eq', value: roomId }]),
  ])
  const latest = new Map<string, PreferenceRow>()
  for (const row of preferences) {
    const current = latest.get(row.user_id)
    if (!current || new Date(row.updated_at).getTime() > new Date(current.updated_at).getTime()) latest.set(row.user_id, row)
  }
  return members.flatMap((member) => {
    const row = latest.get(member.userId)
    if (!row) return []
    const answers = answersFromPreference(row)
    return hasAnswers(answers) ? [{ userId: member.userId, name: member.name, answers }] : []
  })
}

export async function loadGroupLimits(roomId: string): Promise<GroupLimits> {
  const [room] = await selectRows<{ group_limits: unknown }>('trip_rooms', ['group_limits'], [{ column: 'id', operator: 'eq', value: roomId }])
  const limits = room?.group_limits && typeof room.group_limits === 'object' ? room.group_limits as Record<string, unknown> : {}
  return { budgetBand: normaliseBand(limits.budgetBand), noGo: normaliseNoGo(limits.noGo) }
}

export function loadCatalogue() {
  return selectRows<CatalogueTrip>('itinerary_catalogue', catalogueColumns)
}

function sharedVibe(members: ScoringMember[]): Feeling[] {
  return FEELINGS.map((feeling) => ({ feeling, count: members.filter((member) => member.answers.feelings.includes(feeling)).length }))
    .filter((item) => item.count > 0).sort((a, b) => b.count - a.count).slice(0, 3).map((item) => item.feeling)
}

export async function recommendForQuest(roomId: string) {
  const members = await loadScoringMembers(roomId)
  if (!members.length) return { travelDna: null, memberCount: 0, results: [], clashes: [], blockers: [] }
  const [limits, catalogue] = await Promise.all([loadGroupLimits(roomId), loadCatalogue()])
  const result = scoreGroup({ members, limits, catalogue })
  const noGos = [...new Set([...members.flatMap((member) => member.answers.noGo), ...(limits.noGo ?? [])])]
  return {
    memberCount: members.length,
    travelDna: { sharedVibe: sharedVibe(members), budgetStyle: effectiveBudgetBand(members, limits) ?? 'Flexible', noGoActivities: noGos.map((tag) => NO_GO_LABELS[tag]) },
    results: result.paths.map((path) => ({ ...path, score: path.groupScore, matchedPreferences: path.matchedFeelings, compromises: [path.stretch ? 'Someone is below a comfortable fit on this one.' : 'Nothing on anyone’s no-go list.'] })),
    clashes: result.clashes,
    blockers: result.blockers,
  }
}

export async function lowestFitFor(roomId: string, itineraryId: string): Promise<number | null> {
  const [members, trips] = await Promise.all([loadScoringMembers(roomId), selectRows<CatalogueTrip>('itinerary_catalogue', catalogueColumns, [{ column: 'id', operator: 'eq', value: itineraryId }])])
  const trip = trips[0]
  if (!members.length || !trip) return null
  return Math.min(...members.map((member) => memberFit(trip, member.answers).fit))
}
```

- [ ] **Step 6: Protect the route**

Replace the whole of `backend/src/routes/recommendations.ts` with:

```ts
import { Router } from 'express'
import { recommendForQuest } from '../services/recommendationService.js'
import { requireMember, sendError } from '../middleware/access.js'

export const recommendationsRouter = Router()
recommendationsRouter.get('/quests/:roomId', async (request, response, next) => {
  try {
    const access = await requireMember(request, response)
    if (!access) return
    response.json({ data: await recommendForQuest(access.roomId) })
  } catch (error) {
    sendError(response, next, error)
  }
})
```

- [ ] **Step 7: Add the suite to the provider runner**

In `backend/tests/run-provider-tests.mjs`, replace:

```js
  const crewSuites = []
```

with:

```js
  const crewSuites = ['tests/recommendations.integration.test.ts']
```

- [ ] **Step 8: Run the tests to confirm they pass**

Run: `npm --prefix backend run test:one -- tests/recommendations.integration.test.ts`
Expected: PASS

Run: `npm --prefix backend run test:providers`
Expected: PASS. This includes the existing `quest recommendations use the selected provider` subtest, which still expects `budgetStyle` to be `Premium`.

- [ ] **Step 9: Commit**

```bash
git add backend/src/services/crewErrors.ts backend/src/services/membership.ts backend/src/middleware/access.ts backend/src/services/recommendationService.ts backend/src/routes/recommendations.ts backend/tests/crewFixtures.ts backend/tests/recommendations.integration.test.ts backend/tests/run-provider-tests.mjs
git commit -m "feat: rank quest plans from members' answers for members only"
```

---

### Task 6: Share links and guest join

**Files:**
- Create: `backend/src/services/shareLinkService.ts`
- Create: `backend/src/controllers/shareLinkController.ts`
- Create: `backend/src/routes/join.ts`
- Create: `backend/tests/shareLinks.integration.test.ts`
- Modify: `backend/src/services/authService.ts`
- Modify: `backend/src/routes/index.ts`
- Modify: `backend/src/routes/rooms.ts`
- Modify: `backend/tests/run-provider-tests.mjs` (`crewSuites`)

**Interfaces:**
- Consumes: from Task 5, `memberRole`, `requireMember`, `optionalUser`, `sendError`, and `CrewError`.
- Produces:
  - `PublicUser.isGuest: boolean`
  - `createGuestUser(name): Promise<{ user: PublicUser; token: string }>`
  - `createShareLink(roomId, ownerId): Promise<{ id; url; expiresAt }>`
  - `revokeShareLink(roomId, linkId): Promise<boolean>`
  - `getShareLink(token): Promise<{ room: { id; name }; organiserName; expiresAt } | undefined>`
  - `joinWithShareLink(token, { name?, user? }): Promise<{ roomId; token?; user? }>`
  - Routes: `POST /api/trip-rooms/:roomId/links`, `DELETE /api/trip-rooms/:roomId/links/:linkId`, `GET /api/join/:token`, `POST /api/join/:token`.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/shareLinks.integration.test.ts`:

```ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { loginUser, userForToken } from '../src/services/authService.js'
import { listUserRooms } from '../src/services/roomService.js'
import { createShareLink, getShareLink, joinWithShareLink, revokeShareLink } from '../src/services/shareLinkService.js'
import { memberRole } from '../src/services/membership.js'
import { closeDatabase, updateRows } from '../src/storage.js'
import { cleanupCrewFixture, createCrewFixture, startApi } from './crewFixtures.js'

const tokenFrom = (url: string) => url.split('/join/')[1]

test(`share links let friends join with only a name (${process.env.DATABASE_PROVIDER})`, async (t) => {
  const fixture = await createCrewFixture()
  const api = await startApi()
  try {
    const link = await createShareLink(fixture.roomId, fixture.owner.user.id)
    const token = tokenFrom(link.url)

    await t.test('links are unguessable, expire in seven days, and show the organiser', async () => {
      assert.match(link.url, /^http:\/\/localhost:5173\/join\/[a-f0-9]{64}$/)
      const days = (Date.parse(link.expiresAt) - Date.now()) / 86400000
      assert.ok(days > 6.9 && days <= 7)
      const details = await getShareLink(token)
      assert.equal(details?.room.id, fixture.roomId)
      assert.equal(details?.organiserName, 'Alex')
    })

    await t.test('a guest joins with a trimmed name and gets a working session', async () => {
      const joined = await joinWithShareLink(token, { name: '  Maya  ' })
      assert.ok(joined.token && joined.user)
      fixture.userIds.push(joined.user.id)
      assert.equal(joined.user.firstName, 'Maya')
      assert.equal(joined.user.isGuest, true)
      assert.equal(joined.user.email, '')
      assert.equal((await userForToken(joined.token))?.id, joined.user.id)
      const rooms = await listUserRooms(joined.user.id)
      assert.deepEqual(rooms.map((room) => [room.id, room.role]), [[fixture.roomId, 'member']])
      await assert.rejects(loginUser('', 'anything'), /incorrect/)
    })

    await t.test('awkward names are rejected or stored literally', async () => {
      await assert.rejects(joinWithShareLink(token, { name: '   ' }), /between 1 and 40/)
      await assert.rejects(joinWithShareLink(token, { name: 'x'.repeat(41) }), /between 1 and 40/)
      const html = await joinWithShareLink(token, { name: '<b>Rohan</b>' })
      fixture.userIds.push(html.user!.id)
      assert.equal(html.user?.firstName, '<b>Rohan</b>')
    })

    await t.test('the organiser opening their own link stays the organiser', async () => {
      await joinWithShareLink(token, { user: fixture.owner.user })
      assert.equal(await memberRole(fixture.roomId, fixture.owner.user.id), 'owner')
    })

    await t.test('expired and revoked links stop working', async () => {
      const expiring = await createShareLink(fixture.roomId, fixture.owner.user.id)
      await updateRows('trip_room_links', { expires_at: '2000-01-01T00:00:00Z' }, [{ column: 'id', operator: 'eq', value: expiring.id }], ['id'])
      assert.equal(await getShareLink(tokenFrom(expiring.url)), undefined)
      await assert.rejects(joinWithShareLink(tokenFrom(expiring.url), { name: 'Late' }), /expired or been turned off/)
      assert.equal(await revokeShareLink(fixture.roomId, link.id), true)
      assert.equal(await getShareLink(token), undefined)
      assert.equal(await revokeShareLink(fixture.roomId, 'link_missing'), false)
    })

    await t.test('HTTP: only the organiser makes links; anyone with a live link can join', async () => {
      const guest = await joinWithShareLink(tokenFrom((await createShareLink(fixture.roomId, fixture.owner.user.id)).url), { name: 'Priya' })
      fixture.userIds.push(guest.user!.id)
      const asGuest = await fetch(`${api.base}/trip-rooms/${fixture.roomId}/links`, { method: 'POST', headers: { Authorization: `Bearer ${guest.token}` } })
      assert.equal(asGuest.status, 403)
      const created = await fetch(`${api.base}/trip-rooms/${fixture.roomId}/links`, { method: 'POST', headers: { Authorization: `Bearer ${fixture.owner.token}` } })
      assert.equal(created.status, 201)
      const { url, id } = ((await created.json()) as { data: { url: string; id: string } }).data
      assert.equal((await fetch(`${api.base}/join/${tokenFrom(url)}`)).status, 200)
      const join = await fetch(`${api.base}/join/${tokenFrom(url)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Sam' }) })
      assert.equal(join.status, 201)
      fixture.userIds.push(((await join.json()) as { data: { user: { id: string } } }).data.user.id)
      assert.equal((await fetch(`${api.base}/join/not-a-token`)).status, 404)
      const revoked = await fetch(`${api.base}/trip-rooms/${fixture.roomId}/links/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${fixture.owner.token}` } })
      assert.equal(revoked.status, 204)
    })
  } finally {
    await api.close()
    await cleanupCrewFixture(fixture)
    await closeDatabase()
  }
})
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `npm --prefix backend run test:one -- tests/shareLinks.integration.test.ts`
Expected: FAIL with `Cannot find module '../src/services/shareLinkService.js'`.

- [ ] **Step 3: Support guests in the auth service**

In `backend/src/services/authService.ts`, make these replacements.

Replace:

```ts
export type PublicUser = { id: string; firstName: string; lastName: string; email: string; country: string | null; createdAt: string }
type User = { id: string; first_name: string | null; last_name: string | null; email: string; country: string | null; password_hash: string; created_at: string }
```

with:

```ts
export type PublicUser = { id: string; firstName: string; lastName: string; email: string; country: string | null; createdAt: string; isGuest: boolean }
type User = { id: string; first_name: string | null; last_name: string | null; email: string; country: string | null; password_hash: string; created_at: string; is_guest: boolean }
```

Replace:

```ts
const userColumns = ['id', 'first_name', 'last_name', 'email', 'country', 'password_hash', 'created_at']
```

with:

```ts
const userColumns = ['id', 'first_name', 'last_name', 'email', 'country', 'password_hash', 'created_at', 'is_guest']
```

Replace:

```ts
    email: String(row.email),
    country: row.country == null ? null : String(row.country),
    password_hash: String(row.password_hash),
    created_at: timestamp(row.created_at as Date | string),
  }
```

with:

```ts
    email: row.email == null ? '' : String(row.email),
    country: row.country == null ? null : String(row.country),
    password_hash: row.password_hash == null ? '' : String(row.password_hash),
    created_at: timestamp(row.created_at as Date | string),
    is_guest: Boolean(row.is_guest),
  }
```

Replace:

```ts
  createdAt: user.created_at,
})
```

with:

```ts
  createdAt: user.created_at,
  isGuest: user.is_guest,
})
```

Replace:

```ts
  if (!user || !(await bcrypt.compare(password, user.password_hash))) throw new Error('Email or password is incorrect.')
```

with:

```ts
  if (!user || user.is_guest || !user.password_hash || !(await bcrypt.compare(password, user.password_hash))) throw new Error('Email or password is incorrect.')
```

Add this to the end of the file:

```ts
export async function createGuestUser(name: string) {
  const firstName = name.trim()
  const row = await insertRow('users', {
    id: `user_${randomUUID()}`, first_name: firstName, last_name: '', email: null, password_hash: null, is_guest: true,
    data: { name: firstName, firstName, guest: true },
  }, userColumns)
  return session(asUser(row))
}
```

- [ ] **Step 4: Write the share-link service**

Create `backend/src/services/shareLinkService.ts`:

```ts
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { insertRow, selectRows, updateRows, upsertRow } from '../storage.js'
import { createGuestUser, type PublicUser } from './authService.js'
import { memberRole } from './membership.js'
import { CrewError } from './crewErrors.js'

const LINK_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000
const UNAVAILABLE = 'This link has expired or been turned off. Ask your organiser for a new one.'
const hash = (value: string) => createHash('sha256').update(value).digest('hex')
const appUrl = () => (process.env.APP_URL ?? process.env.CLIENT_ORIGIN?.split(',')[0] ?? 'http://localhost:5173').trim().replace(/\/$/, '')
type LinkRow = { id: string; trip_room_id: string; created_by: string; expires_at: string | Date; revoked_at: string | Date | null }

export async function createShareLink(roomId: string, ownerId: string) {
  const token = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + LINK_LIFETIME_MS).toISOString()
  const link = await insertRow<{ id: string }>('trip_room_links', { id: `link_${randomUUID()}`, trip_room_id: roomId, token_hash: hash(token), created_by: ownerId, expires_at: expiresAt }, ['id'])
  return { id: link.id, url: `${appUrl()}/join/${token}`, expiresAt }
}

export async function revokeShareLink(roomId: string, linkId: string) {
  const rows = await updateRows('trip_room_links', { revoked_at: new Date().toISOString() }, [
    { column: 'id', operator: 'eq', value: linkId },
    { column: 'trip_room_id', operator: 'eq', value: roomId },
  ], ['id'])
  return rows.length > 0
}

async function activeLink(token: string) {
  const [link] = await selectRows<LinkRow>('trip_room_links', ['id', 'trip_room_id', 'created_by', 'expires_at', 'revoked_at'], [{ column: 'token_hash', operator: 'eq', value: hash(token) }])
  if (!link || link.revoked_at || new Date(link.expires_at).getTime() <= Date.now()) return undefined
  return link
}

export async function getShareLink(token: string) {
  const link = await activeLink(token)
  if (!link) return undefined
  const [[room], [organiser]] = await Promise.all([
    selectRows<{ id: string; name: string }>('trip_rooms', ['id', 'name'], [{ column: 'id', operator: 'eq', value: link.trip_room_id }]),
    selectRows<{ first_name: string | null }>('users', ['first_name'], [{ column: 'id', operator: 'eq', value: link.created_by }]),
  ])
  if (!room) return undefined
  return { room, organiserName: organiser?.first_name?.trim() || 'Your organiser', expiresAt: new Date(link.expires_at).toISOString() }
}

async function addMember(roomId: string, userId: string) {
  if (await memberRole(roomId, userId)) return
  await upsertRow('trip_room_people', { trip_room_id: roomId, user_id: userId, role: 'member', invite_status: 'accepted' }, ['trip_room_id', 'user_id'])
}

export async function joinWithShareLink(token: string, input: { name?: string; user?: PublicUser }): Promise<{ roomId: string; token?: string; user?: PublicUser }> {
  const link = await activeLink(token)
  if (!link) throw new CrewError(404, UNAVAILABLE)
  if (input.user) {
    await addMember(link.trip_room_id, input.user.id)
    return { roomId: link.trip_room_id }
  }
  const name = (input.name ?? '').trim()
  if (name.length < 1 || name.length > 40) throw new CrewError(400, 'Enter a name between 1 and 40 characters.')
  const guest = await createGuestUser(name)
  await addMember(link.trip_room_id, guest.user.id)
  return { roomId: link.trip_room_id, token: guest.token, user: guest.user }
}
```

- [ ] **Step 5: Write the controllers and routes**

Create `backend/src/controllers/shareLinkController.ts`:

```ts
import type { NextFunction, Request, Response } from 'express'
import { requireMember, sendError } from '../middleware/access.js'
import { createShareLink, revokeShareLink } from '../services/shareLinkService.js'
import { routeParam } from '../routes/helpers.js'

export async function postShareLink(request: Request, response: Response, next: NextFunction) {
  try {
    const access = await requireMember(request, response)
    if (!access) return
    if (access.role !== 'owner') return response.status(403).json({ error: 'Only the organiser can share this quest.' })
    return response.status(201).json({ data: await createShareLink(access.roomId, access.user.id) })
  } catch (error) {
    return sendError(response, next, error)
  }
}

export async function deleteShareLink(request: Request, response: Response, next: NextFunction) {
  try {
    const access = await requireMember(request, response)
    if (!access) return
    if (access.role !== 'owner') return response.status(403).json({ error: 'Only the organiser can turn off a link.' })
    if (!await revokeShareLink(access.roomId, routeParam(request, 'linkId'))) return response.status(404).json({ error: 'Link not found.' })
    return response.status(204).send()
  } catch (error) {
    return sendError(response, next, error)
  }
}
```

Create `backend/src/routes/join.ts`:

```ts
import { Router } from 'express'
import { getShareLink, joinWithShareLink } from '../services/shareLinkService.js'
import { optionalUser, sendError } from '../middleware/access.js'
import { payload, routeParam } from './helpers.js'

export const joinRouter = Router()

joinRouter.get('/:token', async (request, response, next) => {
  try {
    const link = await getShareLink(routeParam(request, 'token'))
    if (!link) return response.status(404).json({ error: 'This link has expired or been turned off. Ask your organiser for a new one.' })
    return response.json({ data: link })
  } catch (error) {
    return sendError(response, next, error)
  }
})

joinRouter.post('/:token', async (request, response, next) => {
  try {
    const name = payload(request).name
    const user = await optionalUser(request)
    return response.status(201).json({ data: await joinWithShareLink(routeParam(request, 'token'), { name: typeof name === 'string' ? name : '', user }) })
  } catch (error) {
    return sendError(response, next, error)
  }
})
```

In `backend/src/routes/index.ts`, replace:

```ts
import { recommendationsRouter } from './recommendations.js'
```

with:

```ts
import { recommendationsRouter } from './recommendations.js'
import { joinRouter } from './join.js'
```

and replace:

```ts
apiRouter.use('/invites', invitesRouter)
```

with:

```ts
apiRouter.use('/invites', invitesRouter)
apiRouter.use('/join', joinRouter)
```

In `backend/src/routes/rooms.ts`, replace:

```ts
import { getQuestMessages, postQuestMessage } from '../controllers/chatController.js'
```

with:

```ts
import { getQuestMessages, postQuestMessage } from '../controllers/chatController.js'
import { deleteShareLink, postShareLink } from '../controllers/shareLinkController.js'
```

and replace:

```ts
roomsRouter.patch('/:roomId', patchRoom)
```

with:

```ts
roomsRouter.post('/:roomId/links', postShareLink)
roomsRouter.delete('/:roomId/links/:linkId', deleteShareLink)
roomsRouter.patch('/:roomId', patchRoom)
```

- [ ] **Step 6: Add the suite to the provider runner**

In `backend/tests/run-provider-tests.mjs`, replace:

```js
  const crewSuites = ['tests/recommendations.integration.test.ts']
```

with:

```js
  const crewSuites = ['tests/recommendations.integration.test.ts', 'tests/shareLinks.integration.test.ts']
```

- [ ] **Step 7: Run the tests to confirm they pass**

Run: `npm --prefix backend run test:one -- tests/shareLinks.integration.test.ts`
Expected: PASS

Run: `npm --prefix backend run test:providers`
Expected: PASS. The existing auth subtests still pass with the new `isGuest` field.

- [ ] **Step 8: Commit**

```bash
git add backend/src/services/authService.ts backend/src/services/shareLinkService.ts backend/src/controllers/shareLinkController.ts backend/src/routes/join.ts backend/src/routes/index.ts backend/src/routes/rooms.ts backend/tests/shareLinks.integration.test.ts backend/tests/run-provider-tests.mjs
git commit -m "feat: let friends join a quest from a share link with only a name"
```

---

### Task 7: Quick answers

**Files:**
- Create: `backend/src/services/crewAnswersService.ts`
- Create: `backend/src/controllers/answersController.ts`
- Create: `backend/tests/crewAnswers.integration.test.ts`
- Modify: `backend/src/routes/rooms.ts`
- Modify: `backend/tests/run-provider-tests.mjs` (`crewSuites`)

**Interfaces:**
- Consumes: Task 2 normalisers; Task 5 `requireMember`, `sendError`, and `CrewError`; Task 6 `joinWithShareLink` (in the test only).
- Produces:
  - `StoredSuggestions = { generatedAt: string; source: 'ai' | 'keywords'; people: Array<{ name: string; userId?: string; answers: MemberAnswers }> }`
  - `readMyAnswers(roomId, userId): Promise<MemberAnswers | null>`
  - `writeMyAnswers(roomId, userId, answers): Promise<MemberAnswers>`
  - `saveMyAnswers(roomId, userId, input: unknown)`
  - `suggestionForMember(roomId, user: { id; firstName })`
  - `getMyAnswers(roomId, user)`
  - Routes: `GET` and `PUT /api/trip-rooms/:roomId/answers/me`.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/crewAnswers.integration.test.ts`:

```ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getMyAnswers, readMyAnswers, saveMyAnswers, suggestionForMember } from '../src/services/crewAnswersService.js'
import { createShareLink, joinWithShareLink } from '../src/services/shareLinkService.js'
import { closeDatabase, insertRow, selectRows, updateRows } from '../src/storage.js'
import { cleanupCrewFixture, createCrewFixture, startApi } from './crewFixtures.js'

test(`members save four quick answers (${process.env.DATABASE_PROVIDER})`, async (t) => {
  const fixture = await createCrewFixture()
  const api = await startApi()
  const owner = fixture.owner.user
  try {
    await t.test('nothing is saved at first', async () => {
      assert.deepEqual(await getMyAnswers(fixture.roomId, owner), { answers: null, suggestion: null })
    })

    await t.test('saving keeps known values and one row per member', async () => {
      await assert.rejects(saveMyAnswers(fixture.roomId, owner.id, { feelings: ['Skydiving'] }), /at least one answer/)
      await saveMyAnswers(fixture.roomId, owner.id, { feelings: ['Nature', 'Nature', 'Shopping'], pace: 'A balanced mix', budgetBand: 'Premium', noGo: ['hiking', 'sharks'], note: 'a lake swim' })
      await saveMyAnswers(fixture.roomId, owner.id, { feelings: ['Wellness'], pace: 'Slow & relaxed', budgetBand: 'Moderate', noGo: [] })
      assert.deepEqual(await readMyAnswers(fixture.roomId, owner.id), { feelings: ['Wellness'], pace: 'Slow & relaxed', budgetBand: 'Moderate', noGo: [], note: '' })
      const rows = await selectRows('preferences', ['id'], [{ column: 'trip_room_id', operator: 'eq', value: fixture.roomId }, { column: 'user_id', operator: 'eq', value: owner.id }])
      assert.equal(rows.length, 1)
    })

    await t.test('answers from the long questionnaire still count', async () => {
      const link = await createShareLink(fixture.roomId, owner.id)
      const guest = await joinWithShareLink(link.url.split('/join/')[1], { name: 'Maya' })
      fixture.userIds.push(guest.user!.id)
      await insertRow('preferences', { id: `preference_q_${fixture.suffix}`, user_id: guest.user!.id, trip_room_id: fixture.roomId, budget: 'Moderate', mood_preferences: ['Food & local culture'], data: { pace: 'Busy & activity-filled', noGo: 'no early mornings' } }, ['id'])
      assert.deepEqual(await readMyAnswers(fixture.roomId, guest.user!.id), { feelings: ['Food & Culture'], pace: 'Busy & activity-filled', budgetBand: 'Moderate', noGo: ['early-starts'], note: '' })
    })

    await t.test('chat suggestions are found by user id first, then by first name', async () => {
      const people = [
        { name: 'maya', answers: { feelings: ['Relaxation'], pace: null, budgetBand: null, noGo: ['hiking'], note: '' } },
        { name: 'Alex', userId: owner.id, answers: { feelings: ['Nature'], pace: null, budgetBand: null, noGo: [], note: '' } },
      ]
      await updateRows('trip_rooms', { chat_suggestions: { generatedAt: new Date().toISOString(), source: 'keywords', people } }, [{ column: 'id', operator: 'eq', value: fixture.roomId }], ['id'])
      assert.deepEqual((await suggestionForMember(fixture.roomId, { id: 'someone-else', firstName: 'Maya' }))?.noGo, ['hiking'])
      assert.deepEqual((await suggestionForMember(fixture.roomId, owner))?.feelings, ['Nature'])
      assert.equal(await suggestionForMember(fixture.roomId, { id: 'nobody', firstName: 'Rohan' }), null)
    })

    await t.test('HTTP: members read and save only their own answers', async () => {
      const url = `${api.base}/trip-rooms/${fixture.roomId}/answers/me`
      const saved = await fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${fixture.owner.token}` }, body: JSON.stringify({ feelings: ['Adventure'], pace: 'Busy & activity-filled', budgetBand: 'Flexible', noGo: [], note: '' }) })
      assert.equal(saved.status, 200)
      const read = await fetch(url, { headers: { Authorization: `Bearer ${fixture.owner.token}` } })
      assert.deepEqual(((await read.json()) as { data: { answers: { feelings: string[] } } }).data.answers.feelings, ['Adventure'])
      assert.equal((await fetch(url)).status, 401)
    })
  } finally {
    await api.close()
    await cleanupCrewFixture(fixture)
    await closeDatabase()
  }
})
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `npm --prefix backend run test:one -- tests/crewAnswers.integration.test.ts`
Expected: FAIL with `Cannot find module '../src/services/crewAnswersService.js'`.

- [ ] **Step 3: Write the answers service**

Create `backend/src/services/crewAnswersService.ts`:

```ts
import { randomUUID } from 'node:crypto'
import { insertRow, selectRows, updateRows } from '../storage.js'
import { answersFromPreference, hasAnswers, normaliseAnswers, type MemberAnswers } from './crewVocabulary.js'
import { CrewError } from './crewErrors.js'

export type StoredSuggestions = { generatedAt: string; source: 'ai' | 'keywords'; people: Array<{ name: string; userId?: string; answers: MemberAnswers }> }
type PreferenceRow = { id: string; mood_preferences: unknown; budget: string | null; activities_must_have: string | null; data: unknown; updated_at: string | Date }

async function latestPreference(roomId: string, userId: string) {
  const rows = await selectRows<PreferenceRow>('preferences', ['id', 'mood_preferences', 'budget', 'activities_must_have', 'data', 'updated_at'], [
    { column: 'trip_room_id', operator: 'eq', value: roomId },
    { column: 'user_id', operator: 'eq', value: userId },
  ], { orderBy: 'updated_at', ascending: false, limit: 1 })
  return rows[0]
}

export async function readMyAnswers(roomId: string, userId: string): Promise<MemberAnswers | null> {
  const row = await latestPreference(roomId, userId)
  if (!row) return null
  const answers = answersFromPreference(row)
  return hasAnswers(answers) ? answers : null
}

export async function writeMyAnswers(roomId: string, userId: string, answers: MemberAnswers): Promise<MemberAnswers> {
  const existing = await latestPreference(roomId, userId)
  const previous = existing?.data && typeof existing.data === 'object' ? existing.data as Record<string, unknown> : {}
  const row = { mood_preferences: answers.feelings, budget: answers.budgetBand, data: { ...previous, pace: answers.pace, noGoTags: answers.noGo, note: answers.note, source: 'quick' } }
  if (existing) await updateRows('preferences', { ...row, updated_at: new Date().toISOString() }, [{ column: 'id', operator: 'eq', value: existing.id }], ['id'])
  else await insertRow('preferences', { id: `preference_${randomUUID()}`, user_id: userId, trip_room_id: roomId, ...row }, ['id'])
  return answers
}

export async function saveMyAnswers(roomId: string, userId: string, input: unknown) {
  const answers = normaliseAnswers(input)
  if (!hasAnswers(answers)) throw new CrewError(400, 'Choose at least one answer before saving.')
  return writeMyAnswers(roomId, userId, answers)
}

export async function suggestionForMember(roomId: string, user: { id: string; firstName: string }): Promise<MemberAnswers | null> {
  const [room] = await selectRows<{ chat_suggestions: unknown }>('trip_rooms', ['chat_suggestions'], [{ column: 'id', operator: 'eq', value: roomId }])
  const people = (room?.chat_suggestions as StoredSuggestions | null | undefined)?.people ?? []
  const firstName = user.firstName.trim().toLowerCase()
  const person = people.find((item) => item.userId === user.id) ?? people.find((item) => !item.userId && item.name.trim().toLowerCase() === firstName)
  return person ? normaliseAnswers(person.answers) : null
}

export async function getMyAnswers(roomId: string, user: { id: string; firstName: string }) {
  const [answers, suggestion] = await Promise.all([readMyAnswers(roomId, user.id), suggestionForMember(roomId, user)])
  return { answers, suggestion }
}
```

- [ ] **Step 4: Write the controller and routes**

Create `backend/src/controllers/answersController.ts`:

```ts
import type { NextFunction, Request, Response } from 'express'
import { requireMember, sendError } from '../middleware/access.js'
import { getMyAnswers, saveMyAnswers } from '../services/crewAnswersService.js'
import { payload } from '../routes/helpers.js'

export async function getMyCrewAnswers(request: Request, response: Response, next: NextFunction) {
  try {
    const access = await requireMember(request, response)
    if (!access) return
    return response.json({ data: await getMyAnswers(access.roomId, access.user) })
  } catch (error) {
    return sendError(response, next, error)
  }
}

export async function putMyCrewAnswers(request: Request, response: Response, next: NextFunction) {
  try {
    const access = await requireMember(request, response)
    if (!access) return
    return response.json({ data: await saveMyAnswers(access.roomId, access.user.id, payload(request)) })
  } catch (error) {
    return sendError(response, next, error)
  }
}
```

In `backend/src/routes/rooms.ts`, replace:

```ts
import { deleteShareLink, postShareLink } from '../controllers/shareLinkController.js'
```

with:

```ts
import { deleteShareLink, postShareLink } from '../controllers/shareLinkController.js'
import { getMyCrewAnswers, putMyCrewAnswers } from '../controllers/answersController.js'
```

and replace:

```ts
roomsRouter.patch('/:roomId', patchRoom)
```

with:

```ts
roomsRouter.get('/:roomId/answers/me', getMyCrewAnswers)
roomsRouter.put('/:roomId/answers/me', putMyCrewAnswers)
roomsRouter.patch('/:roomId', patchRoom)
```

- [ ] **Step 5: Add the suite to the provider runner**

In `backend/tests/run-provider-tests.mjs`, replace:

```js
  const crewSuites = ['tests/recommendations.integration.test.ts', 'tests/shareLinks.integration.test.ts']
```

with:

```js
  const crewSuites = ['tests/recommendations.integration.test.ts', 'tests/shareLinks.integration.test.ts', 'tests/crewAnswers.integration.test.ts']
```

- [ ] **Step 6: Run the tests to confirm they pass**

Run: `npm --prefix backend run test:one -- tests/crewAnswers.integration.test.ts`
Expected: PASS

Run: `npm --prefix backend run test:providers`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add backend/src/services/crewAnswersService.ts backend/src/controllers/answersController.ts backend/src/routes/rooms.ts backend/tests/crewAnswers.integration.test.ts backend/tests/run-provider-tests.mjs
git commit -m "feat: save four private quick answers per member"
```

---

### Task 8: Reading the chat into suggestions

**Files:**
- Create: `backend/src/services/chatSuggestionService.ts`
- Create: `backend/src/controllers/chatSuggestionController.ts`
- Create: `backend/tests/chatSuggestions.test.ts`
- Create: `backend/tests/chatSuggestions.integration.test.ts`
- Modify: `backend/src/services/companionService.ts`
- Modify: `backend/src/routes/rooms.ts`
- Modify: `backend/package.json` (the `test` script)
- Modify: `backend/tests/run-provider-tests.mjs` (`crewSuites`)

**Interfaces:**
- Consumes: Task 2 vocabulary; Task 5 `acceptedMembers` and `CrewError`; Task 7 `StoredSuggestions`.
- Produces:
  - `askJson(prompt): Promise<unknown>`, which returns `undefined` when no provider is configured or the call fails
  - `ChatLine = { name; userId?; text }`
  - `PersonSuggestion = { name; userId?; answers }`
  - `parsePastedChat(text): ChatLine[]`
  - `keywordAnswers(text): MemberAnswers`
  - `keywordSuggestions(lines): PersonSuggestion[]`
  - `normaliseAiPeople(raw, allowedNames): PersonSuggestion[]`
  - `generateChatSuggestions(roomId, requester: { id; firstName }, pastedText?): Promise<{ source; people: Array<{ name; matched }>; mine: MemberAnswers | null }>`
  - Route: `POST /api/trip-rooms/:roomId/chat-suggestions`.

- [ ] **Step 1: Write the failing unit test**

Create `backend/tests/chatSuggestions.test.ts`:

```ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { keywordAnswers, keywordSuggestions, normaliseAiPeople, parsePastedChat } from '../src/services/chatSuggestionService.js'

test('real WhatsApp exports become people and messages', () => {
  const pasted = [
    '[07/10/2026, 19:00:00] Group: \u200eMessages and calls are end-to-end encrypted.',
    '[07/10/2026, 19:03:40] Maya: I’d love a slow beach week',
    '07/10/2026, 19:04 - Rohan: Rafting!',
    '10/7/26, 7:05\u202fPM - Alex Rivera: food please',
    'Maya: <Media omitted>',
    '12:30 lunch?',
    '',
    'Messages and calls are end-to-end encrypted. No one outside of this chat can read them.',
  ].join('\n')
  assert.deepEqual(parsePastedChat(pasted), [
    { name: 'Maya', text: 'I’d love a slow beach week' },
    { name: 'Rohan', text: 'Rafting!' },
    { name: 'Alex Rivera', text: 'food please' },
  ])
})

test('keywords separate wishes from no-gos', () => {
  assert.deepEqual(keywordAnswers('I’d love a slow beach week, no hiking please'), { feelings: ['Relaxation'], pace: 'Slow & relaxed', budgetBand: null, noGo: ['hiking'], note: '' })
  assert.deepEqual(keywordAnswers('My knee is still bad. Money is a bit tight'), { feelings: [], pace: null, budgetBand: 'Budget-friendly', noGo: ['lots-of-walking'], note: '' })
  assert.deepEqual(keywordAnswers('I want adventure! Rafting, mountains. Happy to splurge a bit'), { feelings: ['Adventure', 'Nature'], pace: null, budgetBand: 'Premium', noGo: [], note: '' })
  assert.equal(keywordAnswers('We should go to Barcelona').feelings.includes('Nightlife'), false)
})

test('suggestions group by person and drop people with nothing to suggest', () => {
  const people = keywordSuggestions([{ name: 'Maya', text: 'beach please' }, { name: 'maya', text: 'no hiking' }, { name: 'Rohan', text: 'ok' }])
  assert.deepEqual(people, [{ name: 'Maya', userId: undefined, answers: { feelings: ['Relaxation'], pace: null, budgetBand: null, noGo: ['hiking'], note: '' } }])
})

test('AI output is limited to people in the chat and known values', () => {
  const raw = { people: [{ name: 'maya', feelings: ['Relaxation', 'Skydiving'], pace: 'Turbo', noGo: ['hiking', 'sharks'] }, { name: 'Stranger', feelings: ['Nature'] }, 'junk'] }
  assert.deepEqual(normaliseAiPeople(raw, ['Maya', 'Rohan']), [{ name: 'Maya', answers: { feelings: ['Relaxation'], pace: null, budgetBand: null, noGo: ['hiking'], note: '' } }])
  assert.deepEqual(normaliseAiPeople(undefined, ['Maya']), [])
  assert.deepEqual(normaliseAiPeople({ people: 'nope' }, ['Maya']), [])
})
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `(cd backend && node --import tsx --test tests/chatSuggestions.test.ts)`
Expected: FAIL with `Cannot find module '../src/services/chatSuggestionService.js'`.

- [ ] **Step 3: Add `askJson` to the companion service**

In `backend/src/services/companionService.ts`, replace:

```ts
export async function askCompanion(request: CompanionRequest) {
  const provider = configuredProvider()
  if (!provider) return { ...fallback(request), source: 'fallback' as const }

  const isOllama = provider === 'ollama'
  const apiKey = isOllama ? process.env.OLLAMA_API_KEY : process.env.OPENAI_API_KEY
  if (!apiKey) return { ...fallback(request), source: 'fallback' as const }
  const client = new OpenAI({
    apiKey,
    ...(isOllama ? { baseURL: process.env.OLLAMA_BASE_URL ?? 'https://ollama.com/v1' } : {}),
  })
```

with:

```ts
function aiClient() {
  const provider = configuredProvider()
  if (!provider) return undefined
  const isOllama = provider === 'ollama'
  const apiKey = isOllama ? process.env.OLLAMA_API_KEY : process.env.OPENAI_API_KEY
  if (!apiKey) return undefined
  const client = new OpenAI({ apiKey, ...(isOllama ? { baseURL: process.env.OLLAMA_BASE_URL ?? 'https://ollama.com/v1' } : {}) })
  const model = isOllama ? (process.env.OLLAMA_MODEL ?? 'gpt-oss:20b') : (process.env.OPENAI_MODEL ?? 'gpt-5-mini')
  return { client, model, provider }
}

export async function askJson(prompt: string): Promise<unknown> {
  const ai = aiClient()
  if (!ai) return undefined
  try {
    const result = await ai.client.responses.create({ model: ai.model, input: prompt })
    return JSON.parse(result.output_text.trim().replace(/^`{3}(?:json)?\s*|\s*`{3}$/g, ''))
  } catch (error) {
    console.error('AI request failed; using basic matching instead.', error)
    return undefined
  }
}

export async function askCompanion(request: CompanionRequest) {
  const ai = aiClient()
  if (!ai) return { ...fallback(request), source: 'fallback' as const }
  const { client, provider } = ai
  const isOllama = provider === 'ollama'
```

The rest of `askCompanion` is unchanged. It still uses `client`, `isOllama`, and `provider`.

- [ ] **Step 4: Write the chat suggestion service**

Create `backend/src/services/chatSuggestionService.ts`:

```ts
import { selectRows, updateRows } from '../storage.js'
import { askJson } from './companionService.js'
import { acceptedMembers } from './membership.js'
import { CrewError } from './crewErrors.js'
import type { StoredSuggestions } from './crewAnswersService.js'
import { BUDGET_BANDS, FEELINGS, NO_GOS, NO_GO_KEYWORDS, PACES, hasAnswers, normaliseAnswers, type BudgetBand, type Feeling, type MemberAnswers, type NoGo, type Pace } from './crewVocabulary.js'

export type ChatLine = { name: string; userId?: string; text: string }
export type PersonSuggestion = { name: string; userId?: string; answers: MemberAnswers }

const NEGATIVE = /\b(no|nobody|not|don'?t|can'?t|cannot|avoid|hate|never|skip|without)\b/
const SYSTEM_LINE = /(end-to-end encrypted|<media omitted>|this message was deleted)/i
const HEALTH_WORDS = ['knee', 'mobility', 'wheelchair', 'on my feet', 'back pain']
const FEELING_KEYWORDS: Record<Feeling, string[]> = {
  Adventure: ['adventure', 'adrenaline', 'thrill', 'rafting', 'zipline'],
  'Food & Culture': ['food', 'eat', 'culture', 'museum', 'history', 'market'],
  Relaxation: ['relax', 'relaxing', 'relaxed', 'chill', 'beach', 'unwind', 'lazy'],
  Nature: ['nature', 'mountain', 'forest', 'lake', 'outdoors', 'waterfall'],
  Nightlife: ['nightlife', 'party', 'bar', 'club', 'dancing'],
  Wellness: ['spa', 'yoga', 'wellness', 'massage', 'retreat'],
}
const PACE_KEYWORDS: Record<Pace, string[]> = {
  'Slow & relaxed': ['slow', 'take it easy', 'lazy'],
  'A balanced mix': ['balanced', 'bit of both', 'mix of'],
  'Busy & activity-filled': ['packed', 'busy', 'see everything', 'as much as possible'],
}
const BUDGET_KEYWORDS: Array<[BudgetBand, string[]]> = [
  ['Budget-friendly', ['tight', 'cheap', 'broke', 'affordable', 'low budget', 'on a budget', 'save money']],
  ['Premium', ['splurge', 'luxury', 'premium', 'fancy', 'treat ourselves']],
  ['Moderate', ['mid-range', 'mid range', 'moderate']],
]

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const hasWord = (text: string, word: string) => new RegExp(`\\b${escapeRegExp(word)}s?\\b`).test(text)
const clauses = (text: string) => text.toLowerCase().replace(/[’‘]/g, "'").split(/[.!?;,\n]+|\bbut\b/).map((part) => part.trim()).filter(Boolean)

export function parsePastedChat(text: string): ChatLine[] {
  return text.split(/\r?\n/).flatMap((raw) => {
    const line = raw.replace(/\u200e/g, '').replace(/^\[[^\]]+\]\s*/, '').replace(/^\d{1,2}[./-]\d{1,2}[./-]\d{2,4},?\s+\d{1,2}:\d{2}(?::\d{2})?\s*(?:[ap]\.?m\.?)?\s*-\s*/i, '')
    const match = line.match(/^([^:]{1,40}):\s*(.+)$/)
    if (!match || !/\p{L}/u.test(match[1]) || SYSTEM_LINE.test(match[2])) return []
    return [{ name: match[1].trim(), text: match[2].trim() }]
  })
}

export function keywordAnswers(text: string): MemberAnswers {
  const parts = clauses(text)
  const positive = parts.filter((part) => !NEGATIVE.test(part))
  const negative = parts.filter((part) => NEGATIVE.test(part))
  const feelings = FEELINGS.filter((feeling) => positive.some((part) => FEELING_KEYWORDS[feeling].some((word) => hasWord(part, word))))
  const noGo = NO_GOS.filter((tag) => negative.some((part) => NO_GO_KEYWORDS[tag].some((word) => part.includes(word)))
    || (tag === 'lots-of-walking' && parts.some((part) => HEALTH_WORDS.some((word) => part.includes(word)))))
  const pace = PACES.find((option) => positive.some((part) => PACE_KEYWORDS[option].some((word) => hasWord(part, word)))) ?? null
  const budgetBand = BUDGET_KEYWORDS.find(([, words]) => parts.some((part) => words.some((word) => part.includes(word))))?.[0]
    ?? (negative.some((part) => /\b(spend|afford|expensive)\b/.test(part)) ? 'Budget-friendly' : null)
  return normaliseAnswers({ feelings, pace, budgetBand, noGo, note: '' })
}

export function keywordSuggestions(lines: ChatLine[]): PersonSuggestion[] {
  const byPerson = new Map<string, { name: string; userId?: string; texts: string[] }>()
  for (const line of lines) {
    const key = line.userId ?? `name:${line.name.toLowerCase()}`
    const entry = byPerson.get(key) ?? { name: line.name, userId: line.userId, texts: [] }
    entry.texts.push(line.text)
    byPerson.set(key, entry)
  }
  return [...byPerson.values()]
    .map((entry) => ({ name: entry.name, userId: entry.userId, answers: keywordAnswers(entry.texts.join('. ')) }))
    .filter((person) => hasAnswers(person.answers))
}

export function normaliseAiPeople(raw: unknown, allowedNames: string[]): PersonSuggestion[] {
  const people = raw && typeof raw === 'object' && Array.isArray((raw as { people?: unknown }).people) ? (raw as { people: unknown[] }).people : []
  const allowed = new Map(allowedNames.map((name) => [name.toLowerCase(), name]))
  return people.flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const record = item as Record<string, unknown>
    const name = allowed.get(String(record.name ?? '').trim().toLowerCase())
    if (!name) return []
    const answers = normaliseAnswers(record)
    return hasAnswers(answers) ? [{ name, answers }] : []
  })
}

function chatPrompt(lines: ChatLine[]) {
  return `You read a group travel chat and note each person's own travel wishes. Use only these values.
feelings (up to 3): ${FEELINGS.join(', ')}
pace: ${PACES.join(', ')}
budgetBand: ${BUDGET_BANDS.join(', ')}
noGo: ${NO_GOS.join(', ')}
Only include what a person said about themselves. Use null or [] when unsure. note is one short phrase about something they really want, or "".
Return JSON only: {"people":[{"name":"","feelings":[],"pace":null,"budgetBand":null,"noGo":[],"note":""}]}
Chat:
${lines.map((line) => `${line.name}: ${line.text}`).join('\n')}`
}

export async function generateChatSuggestions(roomId: string, requester: { id: string; firstName: string }, pastedText = '') {
  const [messages, members] = await Promise.all([
    selectRows<{ sender_id: string; body: string }>('trip_room_messages', ['sender_id', 'body'], [{ column: 'trip_room_id', operator: 'eq', value: roomId }], { orderBy: 'created_at', ascending: true, limit: 200 }),
    acceptedMembers(roomId),
  ])
  const byId = new Map(members.map((member) => [member.userId, member]))
  const byFirstName = new Map(members.map((member) => [member.firstName.toLowerCase(), member]))
  const lines: ChatLine[] = [
    ...messages.flatMap((message) => {
      const member = byId.get(message.sender_id)
      return member ? [{ name: member.firstName, userId: member.userId, text: message.body }] : []
    }),
    ...parsePastedChat(pastedText.slice(0, 20000)).map((line) => {
      const member = byFirstName.get(line.name.split(/\s+/)[0].toLowerCase())
      return member ? { name: member.firstName, userId: member.userId, text: line.text } : line
    }),
  ]
  if (!lines.length) throw new CrewError(422, 'There’s nothing to read yet — chat a little, or paste your group chat.')
  const ai = normaliseAiPeople(await askJson(chatPrompt(lines)), [...new Set(lines.map((line) => line.name))])
  const source = ai.length ? 'ai' as const : 'keywords' as const
  const people: PersonSuggestion[] = ai.length ? ai.map((person) => ({ ...person, userId: lines.find((line) => line.name === person.name)?.userId })) : keywordSuggestions(lines)
  const stored: StoredSuggestions = { generatedAt: new Date().toISOString(), source, people }
  await updateRows('trip_rooms', { chat_suggestions: stored }, [{ column: 'id', operator: 'eq', value: roomId }], ['id'])
  const firstName = requester.firstName.toLowerCase()
  const mine = people.find((person) => person.userId === requester.id) ?? people.find((person) => !person.userId && person.name.toLowerCase() === firstName)
  return { source, people: people.map((person) => ({ name: person.name, matched: Boolean(person.userId) })), mine: mine?.answers ?? null }
}
```

- [ ] **Step 5: Write the controller and route**

Create `backend/src/controllers/chatSuggestionController.ts`:

```ts
import type { NextFunction, Request, Response } from 'express'
import { requireMember, sendError } from '../middleware/access.js'
import { generateChatSuggestions } from '../services/chatSuggestionService.js'
import { payload } from '../routes/helpers.js'

export async function postChatSuggestions(request: Request, response: Response, next: NextFunction) {
  try {
    const access = await requireMember(request, response)
    if (!access) return
    const pasted = payload(request).pastedText
    return response.json({ data: await generateChatSuggestions(access.roomId, access.user, typeof pasted === 'string' ? pasted : '') })
  } catch (error) {
    return sendError(response, next, error)
  }
}
```

In `backend/src/routes/rooms.ts`, replace:

```ts
import { getMyCrewAnswers, putMyCrewAnswers } from '../controllers/answersController.js'
```

with:

```ts
import { getMyCrewAnswers, putMyCrewAnswers } from '../controllers/answersController.js'
import { postChatSuggestions } from '../controllers/chatSuggestionController.js'
```

and replace:

```ts
roomsRouter.patch('/:roomId', patchRoom)
```

with:

```ts
roomsRouter.post('/:roomId/chat-suggestions', postChatSuggestions)
roomsRouter.patch('/:roomId', patchRoom)
```

- [ ] **Step 6: Write the failing integration test**

Create `backend/tests/chatSuggestions.integration.test.ts`:

```ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { generateChatSuggestions } from '../src/services/chatSuggestionService.js'
import { getMyAnswers } from '../src/services/crewAnswersService.js'
import { createQuestMessage } from '../src/services/chatService.js'
import { createRoom } from '../src/services/roomService.js'
import { createShareLink, joinWithShareLink } from '../src/services/shareLinkService.js'
import { closeDatabase, deleteRows } from '../src/storage.js'
import { cleanupCrewFixture, createCrewFixture } from './crewFixtures.js'

test(`reading the chat suggests answers privately (${process.env.DATABASE_PROVIDER})`, async () => {
  const fixture = await createCrewFixture()
  const token = (await createShareLink(fixture.roomId, fixture.owner.user.id)).url.split('/join/')[1]
  try {
    const maya = await joinWithShareLink(token, { name: 'Maya' })
    fixture.userIds.push(maya.user!.id)
    await createQuestMessage(fixture.roomId, maya.user!.id, 'I’d love a slow beach week, no hiking please')
    const result = await generateChatSuggestions(fixture.roomId, fixture.owner.user, 'Priya: we should splurge, no early mornings')
    assert.equal(result.source, 'keywords')
    assert.deepEqual(result.people, [{ name: 'Maya', matched: true }, { name: 'Priya', matched: false }])
    assert.equal(result.mine, null)
    assert.deepEqual((await getMyAnswers(fixture.roomId, maya.user!)).suggestion, { feelings: ['Relaxation'], pace: 'Slow & relaxed', budgetBand: null, noGo: ['hiking'], note: '' })
    const priya = await joinWithShareLink(token, { name: 'Priya' })
    fixture.userIds.push(priya.user!.id)
    assert.deepEqual((await getMyAnswers(fixture.roomId, priya.user!)).suggestion, { feelings: [], pace: null, budgetBand: 'Premium', noGo: ['early-starts'], note: '' })
    const empty = await createRoom({ name: 'Quiet quest', tripName: 'Nowhere', ownerId: fixture.owner.user.id })
    await assert.rejects(generateChatSuggestions(empty.id, fixture.owner.user), /nothing to read/)
    await deleteRows('trip_rooms', [{ column: 'id', operator: 'eq', value: empty.id }])
  } finally {
    await cleanupCrewFixture(fixture)
    await closeDatabase()
  }
})
```

- [ ] **Step 7: Register the suites**

In `backend/package.json`, replace:

```json
    "test": "node --import tsx --test tests/databaseConfig.test.ts tests/crewVocabulary.test.ts tests/catalogueSeed.test.ts tests/groupScoring.test.ts",
```

with:

```json
    "test": "node --import tsx --test tests/databaseConfig.test.ts tests/crewVocabulary.test.ts tests/catalogueSeed.test.ts tests/groupScoring.test.ts tests/chatSuggestions.test.ts",
```

In `backend/tests/run-provider-tests.mjs`, replace:

```js
  const crewSuites = ['tests/recommendations.integration.test.ts', 'tests/shareLinks.integration.test.ts', 'tests/crewAnswers.integration.test.ts']
```

with:

```js
  const crewSuites = ['tests/recommendations.integration.test.ts', 'tests/shareLinks.integration.test.ts', 'tests/crewAnswers.integration.test.ts', 'tests/chatSuggestions.integration.test.ts']
```

- [ ] **Step 8: Run the tests to confirm they pass**

Run: `npm --prefix backend test`
Expected: PASS

Run: `npm --prefix backend run test:one -- tests/chatSuggestions.integration.test.ts`
Expected: PASS

Run: `npm --prefix backend run test:providers`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add backend/src/services/companionService.ts backend/src/services/chatSuggestionService.ts backend/src/controllers/chatSuggestionController.ts backend/src/routes/rooms.ts backend/tests/chatSuggestions.test.ts backend/tests/chatSuggestions.integration.test.ts backend/package.json backend/tests/run-provider-tests.mjs
git commit -m "feat: read the crew chat into private answer suggestions"
```

---

### Task 9: Typed changes

**Files:**
- Create: `backend/src/services/changeService.ts`
- Create: `backend/src/controllers/changeController.ts`
- Create: `backend/tests/changeParser.test.ts`
- Create: `backend/tests/changes.integration.test.ts`
- Modify: `backend/src/routes/rooms.ts`
- Modify: `backend/package.json` (the `test` script)
- Modify: `backend/tests/run-provider-tests.mjs` (`crewSuites`)

**Interfaces:**
- Consumes: Task 2 vocabulary; Task 4 `effectiveBudgetBand`; Task 5 `loadScoringMembers` and `loadGroupLimits`; Task 7 `readMyAnswers` and `writeMyAnswers`; Task 8 `askJson`.
- Produces:
  - `ParsedChange = { target: 'me' | 'group'; addNoGo: NoGo[]; removeNoGo: NoGo[]; budgetBand: BudgetBand | null; pace: Pace | null; addFeelings: Feeling[] }`
  - `stepDown(band)`
  - `parseChangeKeywords(text, bands: { mine; group }): ParsedChange | undefined`
  - `normaliseAiChange(raw): ParsedChange | undefined`
  - `describeChange(change): string`
  - `applyChange(roomId, userId, text): Promise<{ summary; source }>`
  - Route: `POST /api/trip-rooms/:roomId/changes`.

- [ ] **Step 1: Write the failing unit test**

Create `backend/tests/changeParser.test.ts`:

```ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { describeChange, normaliseAiChange, parseChangeKeywords, stepDown, type ParsedChange } from '../src/services/changeService.js'

const none = { mine: null, group: null }
const change = (overrides: Partial<ParsedChange>): ParsedChange => ({ target: 'me', addNoGo: [], removeNoGo: [], budgetBand: null, pace: null, addFeelings: [], ...overrides })

test('everyday phrases become changes', () => {
  assert.deepEqual(parseChangeKeywords('I can’t do hikes', none), change({ addNoGo: ['hiking'] }))
  assert.deepEqual(parseChangeKeywords('make it cheaper', { mine: 'Premium', group: null }), change({ budgetBand: 'Moderate' }))
  assert.deepEqual(parseChangeKeywords('make it cheaper', none), change({ budgetBand: 'Moderate' }))
  assert.deepEqual(parseChangeKeywords('nobody wants late nights', none), change({ target: 'group', addNoGo: ['late-nights'] }))
  assert.deepEqual(parseChangeKeywords('we should go cheaper', { mine: 'Premium', group: 'Moderate' }), change({ target: 'group', budgetBand: 'Budget-friendly' }))
  assert.deepEqual(parseChangeKeywords('I’m fine with hiking now', none), change({ removeNoGo: ['hiking'] }))
  assert.deepEqual(parseChangeKeywords('slower please', none), change({ pace: 'Slow & relaxed' }))
  assert.deepEqual(parseChangeKeywords('more food please', none), change({ addFeelings: ['Food & Culture'] }))
  assert.equal(parseChangeKeywords('hello there', none), undefined)
})

test('budget steps down one band at a time', () => {
  assert.equal(stepDown('Premium'), 'Moderate')
  assert.equal(stepDown('Moderate'), 'Budget-friendly')
  assert.equal(stepDown('Budget-friendly'), 'Budget-friendly')
  assert.equal(stepDown('Flexible'), 'Moderate')
})

test('AI changes keep only known values, and group changes ignore personal fields', () => {
  assert.deepEqual(normaliseAiChange({ target: 'group', addNoGo: ['hiking', 'x'], pace: 'Slow & relaxed', addFeelings: ['Nature'] }), change({ target: 'group', addNoGo: ['hiking'] }))
  assert.equal(normaliseAiChange({}), undefined)
  assert.equal(normaliseAiChange('junk'), undefined)
})

test('summaries speak to the person who typed the change', () => {
  assert.equal(describeChange(change({ addNoGo: ['hiking'] })), 'Added to your no-gos: Hiking.')
  assert.equal(describeChange(change({ target: 'group', addNoGo: ['late-nights'] })), 'No late nights for anyone.')
  assert.equal(describeChange(change({ budgetBand: 'Moderate' })), 'Your budget is now Moderate.')
  assert.equal(describeChange(change({ target: 'group', budgetBand: 'Budget-friendly' })), 'Every plan now stays within Budget-friendly.')
  assert.equal(describeChange(change({ pace: 'Slow & relaxed' })), 'Your pace is now slow & relaxed.')
})
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `(cd backend && node --import tsx --test tests/changeParser.test.ts)`
Expected: FAIL with `Cannot find module '../src/services/changeService.js'`.

- [ ] **Step 3: Write the change service**

Create `backend/src/services/changeService.ts`:

```ts
import { updateRows } from '../storage.js'
import { askJson } from './companionService.js'
import { readMyAnswers, writeMyAnswers } from './crewAnswersService.js'
import { loadGroupLimits, loadScoringMembers } from './recommendationService.js'
import { effectiveBudgetBand } from './groupScoring.js'
import { CrewError } from './crewErrors.js'
import { BUDGET_BANDS, FEELINGS, NO_GOS, NO_GO_KEYWORDS, NO_GO_LABELS, PACES, emptyAnswers, normaliseBand, normaliseFeelings, normaliseNoGo, normalisePace, type BudgetBand, type Feeling, type NoGo, type Pace } from './crewVocabulary.js'

export type ParsedChange = { target: 'me' | 'group'; addNoGo: NoGo[]; removeNoGo: NoGo[]; budgetBand: BudgetBand | null; pace: Pace | null; addFeelings: Feeling[] }

const NEGATIVE = /\b(no|nobody|not|don'?t|can'?t|cannot|avoid|hate|never|skip|without)\b/
const GROUP = /\b(we|us|everyone|everybody|nobody|all of us|the group)\b/
const CHEAPER = /\b(cheaper|lower budget|less expensive|save money|cut costs?)\b/
const SLOWER = /\b(slower|more relaxed|slow down|take it easy)\b/
const BUSIER = /\b(busier|more active|more to do)\b/
const OK_AGAIN = /\b(fine with|okay with|ok with|happy to|can do)\b/
const MORE_FEELING: Record<Feeling, string[]> = { Adventure: ['adventure'], 'Food & Culture': ['food', 'culture'], Relaxation: ['relaxation', 'relaxing'], Nature: ['nature'], Nightlife: ['nightlife'], Wellness: ['wellness', 'spa'] }

const isEmpty = (change: ParsedChange) => !change.addNoGo.length && !change.removeNoGo.length && !change.budgetBand && !change.pace && !change.addFeelings.length

export function stepDown(band: BudgetBand | null): BudgetBand {
  return band === 'Premium' ? 'Moderate' : band === 'Moderate' || band === 'Budget-friendly' ? 'Budget-friendly' : 'Moderate'
}

export function parseChangeKeywords(input: string, bands: { mine: BudgetBand | null; group: BudgetBand | null }): ParsedChange | undefined {
  const text = input.toLowerCase().replace(/[’‘]/g, "'")
  const target = GROUP.test(text) ? 'group' : 'me'
  const negated = NEGATIVE.test(text)
  const mentioned = NO_GOS.filter((tag) => NO_GO_KEYWORDS[tag].some((word) => text.includes(word)))
  const change: ParsedChange = {
    target,
    addNoGo: negated ? mentioned : [],
    removeNoGo: !negated && OK_AGAIN.test(text) ? mentioned : [],
    budgetBand: CHEAPER.test(text) ? stepDown(target === 'group' ? bands.group : bands.mine) : null,
    pace: target === 'me' ? (SLOWER.test(text) ? 'Slow & relaxed' : BUSIER.test(text) ? 'Busy & activity-filled' : null) : null,
    addFeelings: target === 'me' && !negated && /\bmore\b/.test(text) ? FEELINGS.filter((feeling) => MORE_FEELING[feeling].some((word) => text.includes(word))) : [],
  }
  return isEmpty(change) ? undefined : change
}

export function normaliseAiChange(raw: unknown): ParsedChange | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const record = raw as Record<string, unknown>
  const target = record.target === 'group' ? 'group' : 'me'
  const change: ParsedChange = {
    target, addNoGo: normaliseNoGo(record.addNoGo), removeNoGo: normaliseNoGo(record.removeNoGo), budgetBand: normaliseBand(record.budgetBand),
    pace: target === 'me' ? normalisePace(record.pace) : null, addFeelings: target === 'me' ? normaliseFeelings(record.addFeelings) : [],
  }
  return isEmpty(change) ? undefined : change
}

export function describeChange(change: ParsedChange) {
  const labels = (tags: NoGo[]) => tags.map((tag) => NO_GO_LABELS[tag])
  const parts: string[] = []
  if (change.addNoGo.length) parts.push(change.target === 'group' ? `No ${labels(change.addNoGo).join(' or ').toLowerCase()} for anyone.` : `Added to your no-gos: ${labels(change.addNoGo).join(', ')}.`)
  if (change.removeNoGo.length) parts.push(change.target === 'group' ? `${labels(change.removeNoGo).join(', ')} is fine for everyone again.` : `Removed from your no-gos: ${labels(change.removeNoGo).join(', ')}.`)
  if (change.budgetBand) parts.push(change.target === 'group' ? `Every plan now stays within ${change.budgetBand}.` : `Your budget is now ${change.budgetBand}.`)
  if (change.pace) parts.push(`Your pace is now ${change.pace.toLowerCase()}.`)
  if (change.addFeelings.length) parts.push(`Added to your trip feelings: ${change.addFeelings.join(', ')}.`)
  return parts.join(' ')
}

function changePrompt(text: string) {
  return `A traveller typed a change to their group trip plan. Turn it into JSON using only these values.
target: "me" if it is about the person typing, "group" if it is about everyone
addNoGo and removeNoGo: ${NO_GOS.join(', ')}
budgetBand: ${BUDGET_BANDS.join(', ')}, or null unless they asked to spend less or more
pace: ${PACES.join(', ')}, or null
addFeelings: ${FEELINGS.join(', ')}
Return JSON only: {"target":"me","addNoGo":[],"removeNoGo":[],"budgetBand":null,"pace":null,"addFeelings":[]}
Change: ${text}`
}

const merge = (current: NoGo[], add: NoGo[], remove: NoGo[]) => NO_GOS.filter((tag) => (current.includes(tag) && !remove.includes(tag)) || add.includes(tag))

export async function applyChange(roomId: string, userId: string, input: string) {
  const text = input.trim()
  if (!text || text.length > 300) throw new CrewError(400, 'Describe the change in up to 300 characters.')
  const [mine, members, limits] = await Promise.all([readMyAnswers(roomId, userId), loadScoringMembers(roomId), loadGroupLimits(roomId)])
  const keywords = parseChangeKeywords(text, { mine: mine?.budgetBand ?? null, group: effectiveBudgetBand(members, limits) })
  const parsed = keywords ?? normaliseAiChange(await askJson(changePrompt(text)))
  if (!parsed) throw new CrewError(422, 'I couldn’t turn that into a change — try ‘no hiking’ or ‘cheaper’.')
  if (parsed.target === 'group') {
    const groupLimits = { budgetBand: parsed.budgetBand ?? limits.budgetBand ?? null, noGo: merge(limits.noGo ?? [], parsed.addNoGo, parsed.removeNoGo) }
    await updateRows('trip_rooms', { group_limits: groupLimits }, [{ column: 'id', operator: 'eq', value: roomId }], ['id'])
  } else {
    const current = mine ?? emptyAnswers()
    await writeMyAnswers(roomId, userId, {
      ...current,
      noGo: merge(current.noGo, parsed.addNoGo, parsed.removeNoGo),
      feelings: [...new Set([...current.feelings, ...parsed.addFeelings])].slice(-3),
      pace: parsed.pace ?? current.pace,
      budgetBand: parsed.budgetBand ?? current.budgetBand,
    })
  }
  return { summary: describeChange(parsed), source: keywords ? 'keywords' as const : 'ai' as const }
}
```

- [ ] **Step 4: Write the controller and route**

Create `backend/src/controllers/changeController.ts`:

```ts
import type { NextFunction, Request, Response } from 'express'
import { requireMember, sendError } from '../middleware/access.js'
import { applyChange } from '../services/changeService.js'
import { payload } from '../routes/helpers.js'

export async function postChange(request: Request, response: Response, next: NextFunction) {
  try {
    const access = await requireMember(request, response)
    if (!access) return
    const text = payload(request).text
    return response.json({ data: await applyChange(access.roomId, access.user.id, typeof text === 'string' ? text : '') })
  } catch (error) {
    return sendError(response, next, error)
  }
}
```

In `backend/src/routes/rooms.ts`, replace:

```ts
import { postChatSuggestions } from '../controllers/chatSuggestionController.js'
```

with:

```ts
import { postChatSuggestions } from '../controllers/chatSuggestionController.js'
import { postChange } from '../controllers/changeController.js'
```

and replace:

```ts
roomsRouter.patch('/:roomId', patchRoom)
```

with:

```ts
roomsRouter.post('/:roomId/changes', postChange)
roomsRouter.patch('/:roomId', patchRoom)
```

- [ ] **Step 5: Write the failing integration test**

Create `backend/tests/changes.integration.test.ts`:

```ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { applyChange } from '../src/services/changeService.js'
import { readMyAnswers, writeMyAnswers } from '../src/services/crewAnswersService.js'
import { loadGroupLimits, recommendForQuest } from '../src/services/recommendationService.js'
import { closeDatabase } from '../src/storage.js'
import { cleanupCrewFixture, createCrewFixture, startApi } from './crewFixtures.js'

test(`typed changes update answers and re-rank plans (${process.env.DATABASE_PROVIDER})`, async () => {
  const fixture = await createCrewFixture()
  const api = await startApi()
  const ownerId = fixture.owner.user.id
  try {
    await writeMyAnswers(fixture.roomId, ownerId, { feelings: ['Nature'], pace: 'A balanced mix', budgetBand: 'Premium', noGo: [], note: '' })
    assert.deepEqual(await applyChange(fixture.roomId, ownerId, 'I can’t do hikes'), { summary: 'Added to your no-gos: Hiking.', source: 'keywords' })
    assert.deepEqual((await readMyAnswers(fixture.roomId, ownerId))?.noGo, ['hiking'])
    assert.ok((await recommendForQuest(fixture.roomId)).results.every((trip) => !(trip.activity_tags ?? []).includes('hiking')))
    assert.equal((await applyChange(fixture.roomId, ownerId, 'make it cheaper')).summary, 'Your budget is now Moderate.')
    assert.equal((await readMyAnswers(fixture.roomId, ownerId))?.budgetBand, 'Moderate')
    await applyChange(fixture.roomId, ownerId, 'nobody wants big crowds')
    assert.deepEqual((await loadGroupLimits(fixture.roomId)).noGo, ['big-crowds'])
    assert.ok((await recommendForQuest(fixture.roomId)).results.every((trip) => !(trip.activity_tags ?? []).includes('big-crowds')))
    await assert.rejects(applyChange(fixture.roomId, ownerId, 'hello there'), (error: { status?: number }) => error.status === 422)
    await assert.rejects(applyChange(fixture.roomId, ownerId, '  '), (error: { status?: number }) => error.status === 400)
    const http = await fetch(`${api.base}/trip-rooms/${fixture.roomId}/changes`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${fixture.owner.token}` }, body: JSON.stringify({ text: 'slower please' }) })
    assert.equal(http.status, 200)
    assert.equal(((await http.json()) as { data: { summary: string } }).data.summary, 'Your pace is now slow & relaxed.')
  } finally {
    await api.close()
    await cleanupCrewFixture(fixture)
    await closeDatabase()
  }
})
```

- [ ] **Step 6: Register the suites**

In `backend/package.json`, replace:

```json
tests/groupScoring.test.ts tests/chatSuggestions.test.ts",
```

with:

```json
tests/groupScoring.test.ts tests/chatSuggestions.test.ts tests/changeParser.test.ts",
```

In `backend/tests/run-provider-tests.mjs`, replace:

```js
'tests/chatSuggestions.integration.test.ts']
```

with:

```js
'tests/chatSuggestions.integration.test.ts', 'tests/changes.integration.test.ts']
```

- [ ] **Step 7: Run the tests to confirm they pass**

Run: `npm --prefix backend test`
Expected: PASS

Run: `npm --prefix backend run test:one -- tests/changes.integration.test.ts`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add backend/src/services/changeService.ts backend/src/controllers/changeController.ts backend/src/routes/rooms.ts backend/tests/changeParser.test.ts backend/tests/changes.integration.test.ts backend/package.json backend/tests/run-provider-tests.mjs
git commit -m "feat: turn typed changes into answer and group-limit updates"
```

---

### Task 10: Votes, crew status, and decisions

**Files:**
- Create: `backend/src/services/crewService.ts`
- Create: `backend/src/controllers/crewController.ts`
- Create: `backend/tests/crewFlow.integration.test.ts`
- Modify: `backend/src/routes/rooms.ts`
- Modify: `backend/tests/run-provider-tests.mjs` (`crewSuites`)

**Interfaces:**
- Consumes: Task 4 `clashNotes`; Task 5 `acceptedMembers`, `loadScoringMembers`, `lowestFitFor`, and `CrewError`.
- Produces:
  - `CrewMember = { userId; name; role; isGuest; answered; votedFor }`
  - `Decision = { itineraryId; title; decidedAt; minutesToDecide; lowestFit }`
  - `getCrew(roomId): Promise<{ members; clashes; decided }>`
  - `castVote(roomId, userId, itineraryId): Promise<{ decided: Decision | null }>`
  - Routes: `GET /api/trip-rooms/:roomId/crew` and `PUT /api/trip-rooms/:roomId/vote`.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/crewFlow.integration.test.ts`:

```ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { castVote, getCrew } from '../src/services/crewService.js'
import { saveMyAnswers } from '../src/services/crewAnswersService.js'
import { applyChange } from '../src/services/changeService.js'
import { recommendForQuest } from '../src/services/recommendationService.js'
import { createShareLink, joinWithShareLink } from '../src/services/shareLinkService.js'
import { registerUser } from '../src/services/authService.js'
import { closeDatabase, selectRows } from '../src/storage.js'
import { cleanupCrewFixture, createCrewFixture, startApi } from './crewFixtures.js'

const PRIVATE = /Moderate|Premium|Flexible|Budget-friendly|hiking|late-nights|budgetBand|noGo/

test(`a crew goes from link to a decided trip (${process.env.DATABASE_PROVIDER})`, async (t) => {
  const fixture = await createCrewFixture()
  const api = await startApi()
  const owner = fixture.owner.user
  try {
    const token = (await createShareLink(fixture.roomId, owner.id)).url.split('/join/')[1]
    const maya = (await joinWithShareLink(token, { name: 'Maya' })).user!
    const rohan = (await joinWithShareLink(token, { name: 'Rohan' })).user!
    const mayaAgain = (await joinWithShareLink(token, { name: 'Maya' })).user!
    fixture.userIds.push(maya.id, rohan.id, mayaAgain.id)
    await saveMyAnswers(fixture.roomId, owner.id, { feelings: ['Food & Culture', 'Relaxation'], pace: 'A balanced mix', budgetBand: 'Flexible' })
    await saveMyAnswers(fixture.roomId, maya.id, { feelings: ['Relaxation', 'Wellness'], pace: 'Slow & relaxed', budgetBand: 'Moderate', noGo: ['hiking'] })
    await saveMyAnswers(fixture.roomId, rohan.id, { feelings: ['Adventure', 'Nature'], pace: 'A balanced mix', budgetBand: 'Premium' })
    await applyChange(fixture.roomId, maya.id, 'I can’t do late nights')
    const plans = await recommendForQuest(fixture.roomId)

    await t.test('plans fit everyone’s private limits and show each person', async () => {
      assert.ok(plans.results.length > 0)
      for (const trip of plans.results) {
        assert.notEqual(trip.budget, 'Premium')
        assert.ok(!(trip.activity_tags ?? []).some((tag) => tag === 'hiking' || tag === 'late-nights'))
        assert.deepEqual(trip.members.map((member) => member.userId).sort(), [owner.id, maya.id, rohan.id].sort())
        for (const member of trip.members) assert.doesNotMatch(member.reason, PRIVATE)
      }
    })

    await t.test('crew status lists people and progress, never private needs', async () => {
      const crew = await getCrew(fixture.roomId)
      assert.equal(crew.members.length, 4)
      assert.equal(crew.members.filter((member) => member.answered).length, 3)
      assert.doesNotMatch(JSON.stringify(crew), PRIVATE)
      assert.equal(crew.decided, null)
    })

    await t.test('the quest is decided only when everyone who answered picks the same trip', async () => {
      const pick = plans.results[0].id
      const [other] = await selectRows<{ id: string }>('itinerary_catalogue', ['id'], [{ column: 'id', operator: 'in', value: ['catalogue_001', 'catalogue_002'] }]).then((rows) => rows.filter((row) => row.id !== pick))
      assert.equal((await castVote(fixture.roomId, owner.id, pick)).decided, null)
      assert.equal((await castVote(fixture.roomId, maya.id, pick)).decided, null)
      assert.equal((await castVote(fixture.roomId, rohan.id, other.id)).decided, null)
      const decided = (await castVote(fixture.roomId, rohan.id, pick)).decided
      assert.equal(decided?.itineraryId, pick)
      assert.equal(typeof decided?.title, 'string')
      assert.ok((decided?.minutesToDecide ?? -1) >= 0)
      assert.ok(typeof decided?.lowestFit === 'number' && decided.lowestFit <= 100)
      assert.equal((await getCrew(fixture.roomId)).decided?.itineraryId, pick, 'the unanswered duplicate Maya does not block the decision')
      assert.equal((await castVote(fixture.roomId, maya.id, other.id)).decided, null)
      assert.equal((await getCrew(fixture.roomId)).decided, null)
      await assert.rejects(castVote(fixture.roomId, maya.id, 'catalogue_missing'), /collection/)
    })

    await t.test('HTTP: crew status is for members, and votes need a trip', async () => {
      const outsider = await registerUser({ firstName: 'Out', lastName: 'Sider', email: `crew-outsider-${fixture.suffix}@example.invalid`, password: 'Synthetic crew password 2026!' })
      fixture.userIds.push(outsider.user.id)
      assert.equal((await fetch(`${api.base}/trip-rooms/${fixture.roomId}/crew`, { headers: { Authorization: `Bearer ${outsider.token}` } })).status, 403)
      assert.equal((await fetch(`${api.base}/trip-rooms/${fixture.roomId}/crew`, { headers: { Authorization: `Bearer ${fixture.owner.token}` } })).status, 200)
      const missing = await fetch(`${api.base}/trip-rooms/${fixture.roomId}/vote`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${fixture.owner.token}` }, body: JSON.stringify({}) })
      assert.equal(missing.status, 400)
    })
  } finally {
    await api.close()
    await cleanupCrewFixture(fixture)
    await closeDatabase()
  }
})
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `npm --prefix backend run test:one -- tests/crewFlow.integration.test.ts`
Expected: FAIL with `Cannot find module '../src/services/crewService.js'`.

- [ ] **Step 3: Write the crew service**

Create `backend/src/services/crewService.ts`:

```ts
import { selectRows, updateRows, upsertRow } from '../storage.js'
import { acceptedMembers, type RoomRole } from './membership.js'
import { loadScoringMembers, lowestFitFor } from './recommendationService.js'
import { clashNotes } from './groupScoring.js'
import { CrewError } from './crewErrors.js'

export type CrewMember = { userId: string; name: string; role: RoomRole; isGuest: boolean; answered: boolean; votedFor: string | null }
export type Decision = { itineraryId: string; title: string; decidedAt: string; minutesToDecide: number; lowestFit: number | null }
type RoomRow = { id: string; created_at: string | Date; decided_itinerary_id: string | null; decided_at: string | Date | null }

async function roomRow(roomId: string) {
  const [room] = await selectRows<RoomRow>('trip_rooms', ['id', 'created_at', 'decided_itinerary_id', 'decided_at'], [{ column: 'id', operator: 'eq', value: roomId }])
  if (!room) throw new CrewError(404, 'Quest not found.')
  return room
}

const roomVotes = (roomId: string) => selectRows<{ user_id: string; itinerary_id: string }>('trip_room_votes', ['user_id', 'itinerary_id'], [{ column: 'trip_room_id', operator: 'eq', value: roomId }])

async function decisionFor(room: RoomRow): Promise<Decision | null> {
  if (!room.decided_itinerary_id || !room.decided_at) return null
  const [[trip], links, lowestFit] = await Promise.all([
    selectRows<{ title: string }>('itinerary_catalogue', ['title'], [{ column: 'id', operator: 'eq', value: room.decided_itinerary_id }]),
    selectRows<{ created_at: string | Date }>('trip_room_links', ['created_at'], [{ column: 'trip_room_id', operator: 'eq', value: room.id }], { orderBy: 'created_at', ascending: true, limit: 1 }),
    lowestFitFor(room.id, room.decided_itinerary_id),
  ])
  const decidedAt = new Date(room.decided_at)
  const start = new Date(links[0]?.created_at ?? room.created_at).getTime()
  return { itineraryId: room.decided_itinerary_id, title: trip?.title ?? 'Your chosen trip', decidedAt: decidedAt.toISOString(), minutesToDecide: Math.max(0, Math.round((decidedAt.getTime() - start) / 60000)), lowestFit }
}

export async function getCrew(roomId: string) {
  const [room, members, scoring, votes] = await Promise.all([roomRow(roomId), acceptedMembers(roomId), loadScoringMembers(roomId), roomVotes(roomId)])
  const answered = new Set(scoring.map((member) => member.userId))
  const voted = new Map(votes.map((vote) => [vote.user_id, vote.itinerary_id]))
  return {
    members: members.map((member): CrewMember => ({ userId: member.userId, name: member.name, role: member.role, isGuest: member.isGuest, answered: answered.has(member.userId), votedFor: voted.get(member.userId) ?? null })),
    clashes: clashNotes(scoring),
    decided: await decisionFor(room),
  }
}

export async function castVote(roomId: string, userId: string, itineraryId: string) {
  const [trip] = await selectRows<{ id: string }>('itinerary_catalogue', ['id'], [{ column: 'id', operator: 'eq', value: itineraryId }])
  if (!trip) throw new CrewError(404, 'That trip isn’t in the collection.')
  const now = new Date().toISOString()
  await upsertRow('trip_room_votes', { trip_room_id: roomId, user_id: userId, itinerary_id: itineraryId, updated_at: now }, ['trip_room_id', 'user_id'])
  const [scoring, votes, room] = await Promise.all([loadScoringMembers(roomId), roomVotes(roomId), roomRow(roomId)])
  const voted = new Map(votes.map((vote) => [vote.user_id, vote.itinerary_id]))
  const choices = new Set(scoring.map((member) => voted.get(member.userId)))
  const agreed = scoring.length > 0 && choices.size === 1 && !choices.has(undefined) ? [...choices][0] as string : null
  const filter = [{ column: 'id', operator: 'eq' as const, value: roomId }]
  if (agreed && room.decided_itinerary_id !== agreed) await updateRows('trip_rooms', { decided_itinerary_id: agreed, decided_at: now }, filter, ['id'])
  if (!agreed && room.decided_itinerary_id) await updateRows('trip_rooms', { decided_itinerary_id: null, decided_at: null }, filter, ['id'])
  return { decided: await decisionFor(await roomRow(roomId)) }
}
```

- [ ] **Step 4: Write the controller and routes**

Create `backend/src/controllers/crewController.ts`:

```ts
import type { NextFunction, Request, Response } from 'express'
import { requireMember, sendError } from '../middleware/access.js'
import { castVote, getCrew } from '../services/crewService.js'
import { payload } from '../routes/helpers.js'

export async function getCrewStatus(request: Request, response: Response, next: NextFunction) {
  try {
    const access = await requireMember(request, response)
    if (!access) return
    return response.json({ data: await getCrew(access.roomId) })
  } catch (error) {
    return sendError(response, next, error)
  }
}

export async function putVote(request: Request, response: Response, next: NextFunction) {
  try {
    const access = await requireMember(request, response)
    if (!access) return
    const itineraryId = payload(request).itineraryId
    if (typeof itineraryId !== 'string' || !itineraryId.trim()) return response.status(400).json({ error: 'Choose a trip to vote for.' })
    return response.json({ data: await castVote(access.roomId, access.user.id, itineraryId.trim()) })
  } catch (error) {
    return sendError(response, next, error)
  }
}
```

In `backend/src/routes/rooms.ts`, replace:

```ts
import { postChange } from '../controllers/changeController.js'
```

with:

```ts
import { postChange } from '../controllers/changeController.js'
import { getCrewStatus, putVote } from '../controllers/crewController.js'
```

and replace:

```ts
roomsRouter.patch('/:roomId', patchRoom)
```

with:

```ts
roomsRouter.get('/:roomId/crew', getCrewStatus)
roomsRouter.put('/:roomId/vote', putVote)
roomsRouter.patch('/:roomId', patchRoom)
```

- [ ] **Step 5: Add the suite to the provider runner**

In `backend/tests/run-provider-tests.mjs`, replace:

```js
'tests/changes.integration.test.ts']
```

with:

```js
'tests/changes.integration.test.ts', 'tests/crewFlow.integration.test.ts']
```

- [ ] **Step 6: Run the tests to confirm they pass**

Run: `npm --prefix backend run test:one -- tests/crewFlow.integration.test.ts`
Expected: PASS

Run: `npm --prefix backend test && npm --prefix backend run test:providers && npm --prefix backend run build`
Expected: every unit suite and every provider suite passes on both providers, and the TypeScript build has no errors.

- [ ] **Step 7: Commit**

```bash
git add backend/src/services/crewService.ts backend/src/controllers/crewController.ts backend/src/routes/rooms.ts backend/tests/crewFlow.integration.test.ts backend/tests/run-provider-tests.mjs
git commit -m "feat: track crew progress, votes, and the decided trip"
```

---

### Task 11: Front-end crew client, guest sessions, and the join page

**Files:**
- Create: `frontend/src/apis/crew.ts`
- Create: `frontend/src/pages/JoinPage.tsx`
- Create: `frontend/src/styles/crew.css`
- Modify: `frontend/src/auth/AuthContext.tsx`
- Modify: `frontend/src/components/AppShell.tsx`
- Modify: `frontend/src/App.tsx`

**Interfaces:**
- Consumes: the backend routes from Tasks 6–10.
- Produces:
  - The client vocabulary: `FEELINGS`, `PACES`, `BUDGET_BANDS`, `NO_GOS`, `NO_GO_LABELS`, and the types `MemberAnswers`, `MemberFit`, `CrewMember`, `Decision`, `CrewStatus`, `JoinDetails`, `ShareLink`.
  - Client calls: `getJoinDetails`, `joinQuest`, `createShareLink`, `getMyAnswers`, `saveMyAnswers`, `readChat`, `getCrew`, `sendChange`, `voteForTrip`.
  - `useAuth().adoptSession(token, user)`.
  - `AppUser.isGuest?: boolean`.

- [ ] **Step 1: Write the crew API client**

Create `frontend/src/apis/crew.ts`:

```ts
import { apiUrl } from '../services/apiUrl'
import type { AppUser } from '../auth/AuthContext'

export const FEELINGS = ['Adventure', 'Food & Culture', 'Relaxation', 'Nature', 'Nightlife', 'Wellness'] as const
export const PACES = ['Slow & relaxed', 'A balanced mix', 'Busy & activity-filled'] as const
export const BUDGET_BANDS = ['Budget-friendly', 'Moderate', 'Premium', 'Flexible'] as const
export const NO_GOS = ['hiking', 'water-activities', 'late-nights', 'early-starts', 'big-crowds', 'remote-places', 'lots-of-walking'] as const
export type Feeling = typeof FEELINGS[number]
export type Pace = typeof PACES[number]
export type BudgetBand = typeof BUDGET_BANDS[number]
export type NoGo = typeof NO_GOS[number]
export const NO_GO_LABELS: Record<NoGo, string> = {
  hiking: 'Hiking', 'water-activities': 'Water activities', 'late-nights': 'Late nights', 'early-starts': 'Early starts',
  'big-crowds': 'Big crowds', 'remote-places': 'Remote places', 'lots-of-walking': 'Lots of walking',
}

export type MemberAnswers = { feelings: Feeling[]; pace: Pace | null; budgetBand: BudgetBand | null; noGo: NoGo[]; note: string }
export type MemberFit = { userId: string; name: string; fit: number; reason: string }
export type CrewMember = { userId: string; name: string; role: 'owner' | 'member'; isGuest: boolean; answered: boolean; votedFor: string | null }
export type Decision = { itineraryId: string; title: string; decidedAt: string; minutesToDecide: number; lowestFit: number | null }
export type CrewStatus = { members: CrewMember[]; clashes: string[]; decided: Decision | null }
export type JoinDetails = { room: { id: string; name: string }; organiserName: string; expiresAt: string }
export type ShareLink = { id: string; url: string; expiresAt: string }

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem('gotogether.session-token')
  const response = await fetch(apiUrl(path), { ...options, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options?.headers } })
  const body = response.status === 204 ? null : await response.json().catch(() => null) as { data?: T; error?: string } | null
  if (!response.ok) throw new Error(body?.error || 'Something went wrong. Please try again.')
  return body?.data as T
}

export const getJoinDetails = (token: string) => request<JoinDetails>(`/join/${token}`)
export const joinQuest = (token: string, name?: string) => request<{ roomId: string; token?: string; user?: AppUser }>(`/join/${token}`, { method: 'POST', body: JSON.stringify({ name }) })
export const createShareLink = (roomId: string) => request<ShareLink>(`/trip-rooms/${roomId}/links`, { method: 'POST' })
export const getMyAnswers = (roomId: string) => request<{ answers: MemberAnswers | null; suggestion: MemberAnswers | null }>(`/trip-rooms/${roomId}/answers/me`)
export const saveMyAnswers = (roomId: string, answers: MemberAnswers) => request<MemberAnswers>(`/trip-rooms/${roomId}/answers/me`, { method: 'PUT', body: JSON.stringify(answers) })
export const readChat = (roomId: string, pastedText = '') => request<{ source: 'ai' | 'keywords'; people: Array<{ name: string; matched: boolean }>; mine: MemberAnswers | null }>(`/trip-rooms/${roomId}/chat-suggestions`, { method: 'POST', body: JSON.stringify({ pastedText }) })
export const getCrew = (roomId: string) => request<CrewStatus>(`/trip-rooms/${roomId}/crew`)
export const sendChange = (roomId: string, text: string) => request<{ summary: string; source: 'ai' | 'keywords' }>(`/trip-rooms/${roomId}/changes`, { method: 'POST', body: JSON.stringify({ text }) })
export const voteForTrip = (roomId: string, itineraryId: string) => request<{ decided: Decision | null }>(`/trip-rooms/${roomId}/vote`, { method: 'PUT', body: JSON.stringify({ itineraryId }) })
```

- [ ] **Step 2: Let joining adopt a guest session**

In `frontend/src/auth/AuthContext.tsx`, replace:

```ts
export type AppUser = { id: string; firstName: string; lastName: string; email: string; country: string | null; createdAt: string }
```

with:

```ts
export type AppUser = { id: string; firstName: string; lastName: string; email: string; country: string | null; createdAt: string; isGuest?: boolean }
```

Replace:

```ts
requestSignIn: () => void; closeSignInPrompt: () => void; signInPromptOpen: boolean }
```

with:

```ts
requestSignIn: () => void; closeSignInPrompt: () => void; signInPromptOpen: boolean; adoptSession: (token: string, user: AppUser) => void }
```

Replace:

```ts
  const updateProfile = async (input: ProfileInput) =>
```

with:

```ts
  const adoptSession = (token: string, next: AppUser) => {
    localStorage.setItem(key, token); localStorage.setItem('gotogether.current-user-id', next.id)
    setUser(next); setReady(true)
  }
  const updateProfile = async (input: ProfileInput) =>
```

Replace:

```ts
closeSignInPrompt: () => setSignInPromptOpen(false), signInPromptOpen }}>
```

with:

```ts
closeSignInPrompt: () => setSignInPromptOpen(false), signInPromptOpen, adoptSession }}>
```

- [ ] **Step 3: Write the join page**

Create `frontend/src/pages/JoinPage.tsx`:

```tsx
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getJoinDetails, joinQuest, type JoinDetails } from '../apis/crew'
import { useAuth } from '../auth/AuthContext'
import { Icon } from '../components/Ui'

export function JoinPage() {
  const { token = '' } = useParams()
  const navigate = useNavigate()
  const { user, ready, adoptSession } = useAuth()
  const [details, setDetails] = useState<JoinDetails | null>(null)
  const [error, setError] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => { getJoinDetails(token).then(setDetails).catch((reason: Error) => setError(reason.message)) }, [token])
  const join = async (event?: FormEvent) => {
    event?.preventDefault()
    if (busy) return
    setBusy(true); setError('')
    try {
      const result = await joinQuest(token, user ? undefined : name)
      if (result.token && result.user) adoptSession(result.token, result.user)
      navigate(`/quests/${result.roomId}`, { state: { joined: true } })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'We couldn’t add you to this quest. Please try again.')
    } finally {
      setBusy(false)
    }
  }
  if (error && !details) return <section className="auth-page"><div className="auth-card"><p className="eyebrow">JOIN LINK</p><h1>This link is <em>unavailable.</em></h1><p>{error}</p><Link className="primary-button" to="/">Back home <Icon /></Link></div></section>
  if (!details || !ready) return <section className="auth-page"><div className="auth-card"><p className="eyebrow">GO.TOGETHER</p><h1>Opening your <em>invitation…</em></h1></div></section>
  return <section className="auth-page"><div className="auth-card">
    <p className="eyebrow">{details.organiserName.toUpperCase()} SAVED YOU A SEAT</p>
    <h1>Join <em>{details.room.name}.</em></h1>
    <p>Answer four quick questions. Your budget and limits stay private — the plans simply fit them.</p>
    {user
      ? <button className="primary-button" type="button" disabled={busy} onClick={() => void join()}>{busy ? 'Adding you…' : `Join as ${user.firstName}`}<Icon /></button>
      : <form className="join-form" onSubmit={join}>
        <label htmlFor="join-name">What should the crew call you?<input id="join-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={40} autoComplete="given-name" required /></label>
        <button className="primary-button" type="submit" disabled={busy || !name.trim()}>{busy ? 'Adding you…' : 'Join the quest'}<Icon /></button>
      </form>}
    {error && <p className="form-error" role="alert">{error}</p>}
  </div></section>
}
```

- [ ] **Step 4: Add the route and the stylesheet**

In `frontend/src/components/AppShell.tsx`, replace:

```tsx
import { InvitePage } from '../pages/InvitePage'
```

with:

```tsx
import { InvitePage } from '../pages/InvitePage'
import { JoinPage } from '../pages/JoinPage'
```

and replace:

```tsx
      <Route path="/invite/:token" element={<InvitePage key={location.pathname} />} />
```

with:

```tsx
      <Route path="/invite/:token" element={<InvitePage key={location.pathname} />} /><Route path="/join/:token" element={<JoinPage key={location.pathname} />} />
```

In `frontend/src/App.tsx`, replace:

```tsx
import './styles/quest-workspace.css'
```

with:

```tsx
import './styles/quest-workspace.css'
import './styles/crew.css'
```

Create `frontend/src/styles/crew.css`:

```css
.join-form { display: grid; gap: 1rem; margin-top: 1.25rem; }
.join-form label { display: grid; gap: 0.4rem; font-weight: 600; }
.join-form input { padding: 0.8rem 1rem; border: 1px solid rgba(23, 50, 77, 0.2); border-radius: 12px; font: inherit; }
```

- [ ] **Step 5: Lint, build, and check by hand**

Run: `npm --prefix frontend run lint && npm --prefix frontend run build`
Expected: no lint errors, and the build succeeds.

Manual check:

1. Start the backend and frontend with `npm run dev:api` and `npm run dev`.
2. Sign in as an organiser and create a quest.
3. Copy the session token from the browser's local storage (key `gotogether.session-token`), then create a link:

   ```bash
   TOKEN=<paste the session token>
   curl -s -X POST -H "Authorization: Bearer $TOKEN" http://127.0.0.1:3001/api/trip-rooms/<roomId>/links
   ```
4. Open the returned URL in a private window, enter `Maya`, and submit.

Expected: you land on `/quests/<roomId>` signed in as Maya, and the navigation shows `M`.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/apis/crew.ts frontend/src/pages/JoinPage.tsx frontend/src/styles/crew.css frontend/src/auth/AuthContext.tsx frontend/src/components/AppShell.tsx frontend/src/App.tsx
git commit -m "feat: add the join page and guest sessions"
```

---

### Task 12: Crew panel and quick answers in the quest workspace

**Files:**
- Create: `frontend/src/hooks/useCrew.ts`
- Create: `frontend/src/hooks/useLiveQuestRecommendations.ts`
- Create: `frontend/src/components/crew/QuickAnswersForm.tsx`
- Create: `frontend/src/components/crew/CrewPanel.tsx`
- Modify: `frontend/src/pages/QuestDetailPage.tsx`
- Modify: `frontend/src/styles/crew.css`

**Interfaces:**
- Consumes: Task 11's `apis/crew.ts`, and `getQuestRecommendations` from `apis/quests.ts`.
- Produces:
  - `useCrew(roomId, pollMs = 4000): { crew: CrewStatus | null; refresh: () => void }`
  - `useLiveQuestRecommendations(roomId, pollMs = 4000): { data; error; retry }`
  - `<QuickAnswersForm roomId initial fromChat onSaved />`, which renders a form named "My quick answers"
  - `<CrewPanel roomId questName isOwner crew onChanged />`, which renders a region named "Your crew"

- [ ] **Step 1: Write the polling hooks**

Create `frontend/src/hooks/useCrew.ts`:

```ts
import { useCallback, useEffect, useState } from 'react'
import { getCrew, type CrewStatus } from '../apis/crew'

export function useCrew(roomId: string, pollMs = 4000) {
  const [crew, setCrew] = useState<CrewStatus | null>(null)
  const [revision, setRevision] = useState(0)
  const refresh = useCallback(() => setRevision((value) => value + 1), [])
  useEffect(() => {
    let active = true
    const load = () => getCrew(roomId).then((next) => { if (active) setCrew(next) }).catch(() => { /* The next poll retries and the panel keeps the last known crew. */ })
    void load()
    const timer = window.setInterval(load, pollMs)
    return () => { active = false; window.clearInterval(timer) }
  }, [roomId, pollMs, revision])
  return { crew, refresh }
}
```

Create `frontend/src/hooks/useLiveQuestRecommendations.ts`:

```ts
import { useCallback, useEffect, useRef, useState } from 'react'
import { getQuestRecommendations } from '../apis/quests'

type Recommendations = Awaited<ReturnType<typeof getQuestRecommendations>>

export function useLiveQuestRecommendations(roomId: string, pollMs = 4000) {
  const [data, setData] = useState<Recommendations | null>(null)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const loaded = useRef(false)
  const retry = useCallback(() => setRevision((value) => value + 1), [])
  useEffect(() => {
    let active = true
    const load = () => getQuestRecommendations(roomId)
      .then((next) => { if (active) { loaded.current = true; setData(next); setError('') } })
      .catch(() => { if (active && !loaded.current) setError('We couldn’t load this quest’s travel ideas. Please try again.') })
    void load()
    const timer = window.setInterval(load, pollMs)
    return () => { active = false; window.clearInterval(timer) }
  }, [roomId, pollMs, revision])
  return { data, error, retry }
}
```

- [ ] **Step 2: Write the quick-answers form**

Create `frontend/src/components/crew/QuickAnswersForm.tsx`:

```tsx
import { useState, type FormEvent } from 'react'
import { BUDGET_BANDS, FEELINGS, NO_GOS, NO_GO_LABELS, PACES, saveMyAnswers, type Feeling, type MemberAnswers, type NoGo } from '../../apis/crew'

type Props = { roomId: string; initial: MemberAnswers | null; fromChat: boolean; onSaved: (answers: MemberAnswers) => void }
const empty: MemberAnswers = { feelings: [], pace: null, budgetBand: null, noGo: [], note: '' }

export function QuickAnswersForm({ roomId, initial, fromChat, onSaved }: Props) {
  const [answers, setAnswers] = useState<MemberAnswers>(initial ?? empty)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const toggleFeeling = (feeling: Feeling) => setAnswers((current) => current.feelings.includes(feeling)
    ? { ...current, feelings: current.feelings.filter((item) => item !== feeling) }
    : current.feelings.length >= 3 ? current : { ...current, feelings: [...current.feelings, feeling] })
  const toggleNoGo = (tag: NoGo) => setAnswers((current) => ({ ...current, noGo: current.noGo.includes(tag) ? current.noGo.filter((item) => item !== tag) : [...current.noGo, tag] }))
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (busy) return
    setBusy(true); setError('')
    try { onSaved(await saveMyAnswers(roomId, answers)) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'We couldn’t save your answers. Please try again.') }
    finally { setBusy(false) }
  }
  return <form className="crew-answers" onSubmit={submit} aria-label="My quick answers">
    {fromChat && <p className="crew-from-chat">From the chat — check these and change anything that isn’t right.</p>}
    <fieldset><legend>How should the trip feel? <small>Up to three</small></legend><div className="crew-chips">{FEELINGS.map((feeling) => <button type="button" key={feeling} aria-pressed={answers.feelings.includes(feeling)} onClick={() => toggleFeeling(feeling)}>{feeling}</button>)}</div></fieldset>
    <fieldset><legend>Your pace</legend><div className="crew-chips">{PACES.map((pace) => <button type="button" key={pace} aria-pressed={answers.pace === pace} onClick={() => setAnswers((current) => ({ ...current, pace }))}>{pace}</button>)}</div></fieldset>
    <fieldset><legend>Your budget <small>Only the plan sees this</small></legend><div className="crew-chips">{BUDGET_BANDS.map((band) => <button type="button" key={band} aria-pressed={answers.budgetBand === band} onClick={() => setAnswers((current) => ({ ...current, budgetBand: band }))}>{band}</button>)}</div></fieldset>
    <fieldset><legend>Anything you’d rather skip? <small>Private — never shown as yours</small></legend><div className="crew-chips">{NO_GOS.map((tag) => <button type="button" key={tag} aria-pressed={answers.noGo.includes(tag)} onClick={() => toggleNoGo(tag)}>{NO_GO_LABELS[tag]}</button>)}</div></fieldset>
    <label className="crew-note">One thing that would make it perfect <small>Optional</small><input value={answers.note} maxLength={280} onChange={(event) => setAnswers((current) => ({ ...current, note: event.target.value }))} placeholder="A sunset swim, a street-food night…" /></label>
    {error && <p className="form-error" role="alert">{error}</p>}
    <button className="primary-button" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save my answers'}</button>
  </form>
}
```

- [ ] **Step 3: Write the crew panel**

Create `frontend/src/components/crew/CrewPanel.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { createShareLink, getMyAnswers, readChat, type CrewStatus, type MemberAnswers, type ShareLink } from '../../apis/crew'
import { QuickAnswersForm } from './QuickAnswersForm'

type Props = { roomId: string; questName: string; isOwner: boolean; crew: CrewStatus | null; onChanged: () => void }
type Mine = { answers: MemberAnswers | null; suggestion: MemberAnswers | null }

export function CrewPanel({ roomId, questName, isOwner, crew, onChanged }: Props) {
  const [mine, setMine] = useState<Mine | null>(null)
  const [editing, setEditing] = useState(false)
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    let active = true
    getMyAnswers(roomId).then((result) => { if (active) setMine(result) }).catch(() => { if (active) setMine({ answers: null, suggestion: null }) })
    return () => { active = false }
  }, [roomId, revision])
  const refreshMine = () => { setRevision((value) => value + 1); onChanged() }
  const saved = (answers: MemberAnswers) => { setMine({ answers, suggestion: null }); setEditing(false); onChanged() }
  const answered = crew?.members.filter((member) => member.answered).length ?? 0
  const total = crew?.members.length ?? 1
  return <section className="crew-panel" aria-label="Your crew">
    <div className="crew-panel-heading"><div><p className="eyebrow">YOUR CREW</p><h2>{answered} of {total} have answered</h2></div>{isOwner && <ShareLinkButton roomId={roomId} questName={questName} />}</div>
    <ul className="crew-members">{crew?.members.map((member) => <li key={member.userId}><strong>{member.name}</strong>{member.role === 'owner' && <span>Organiser</span>}<small>{member.votedFor ? 'Has picked a trip' : member.answered ? 'Answered' : 'Waiting for answers'}</small></li>)}</ul>
    {crew?.clashes.length ? <ul className="crew-clashes" role="status">{crew.clashes.map((note) => <li key={note}>{note}</li>)}</ul> : null}
    <ChatReader roomId={roomId} onRead={refreshMine} />
    {mine && (mine.answers && !editing
      ? <div className="crew-answered"><p>Your answers are in. Only the plan sees your budget and no-gos.</p><button type="button" className="text-button" onClick={() => setEditing(true)}>Edit my answers</button></div>
      : <QuickAnswersForm key={`${revision}-${editing}`} roomId={roomId} initial={mine.answers ?? mine.suggestion} fromChat={!mine.answers && Boolean(mine.suggestion)} onSaved={saved} />)}
  </section>
}

function ShareLinkButton({ roomId, questName }: { roomId: string; questName: string }) {
  const [link, setLink] = useState<ShareLink | null>(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const create = async () => {
    setError('')
    try { setLink(await createShareLink(roomId)) } catch (reason) { setError(reason instanceof Error ? reason.message : 'We couldn’t create a link.') }
  }
  const copy = async () => {
    if (!link) return
    try { await navigator.clipboard.writeText(link.url); setCopied(true) } catch { setCopied(false) }
  }
  if (!link) return <div className="crew-share"><button type="button" className="primary-button" onClick={() => void create()}>Share a join link</button>{error && <p className="form-error" role="alert">{error}</p>}</div>
  const message = `Join “${questName}” on Go.Together — four quick questions and we’ll find a trip that works for all of us: ${link.url}`
  return <div className="crew-share">
    <label htmlFor="crew-share-url">Join link <small>Works for 7 days</small><input id="crew-share-url" readOnly value={link.url} onFocus={(event) => event.target.select()} /></label>
    <div><button type="button" className="text-button" onClick={() => void copy()}>{copied ? 'Copied' : 'Copy link'}</button><a className="text-button" href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer">Send on WhatsApp</a></div>
  </div>
}

function ChatReader({ roomId, onRead }: { roomId: string; onRead: () => void }) {
  const [pasted, setPasted] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState('')
  const [error, setError] = useState('')
  const read = async () => {
    if (busy) return
    setBusy(true); setError(''); setResult('')
    try {
      const outcome = await readChat(roomId, pasted)
      const names = outcome.people.map((person) => person.name).join(', ')
      setResult(`${names ? `Picked up wishes for ${names}.` : 'Nothing to pick up yet.'}${outcome.source === 'keywords' ? ' (basic matching)' : ''} Everyone sees only their own suggestion.`)
      setPasted('')
      onRead()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'We couldn’t read the chat. Please try again.')
    } finally {
      setBusy(false)
    }
  }
  return <details className="crew-chat-reader">
    <summary>Read our chat for wishes</summary>
    <p>Go.Together reads the crew chat — and anything you paste from WhatsApp — and pre-fills each person’s answers. Nobody else sees what it guessed about you.</p>
    <label htmlFor="crew-paste">Paste a group chat <small>Optional</small><textarea id="crew-paste" rows={4} value={pasted} onChange={(event) => setPasted(event.target.value)} placeholder="Maya: I’d love a slow beach week, no hiking please" /></label>
    <button type="button" className="text-button" disabled={busy} onClick={() => void read()}>{busy ? 'Reading…' : 'Read our chat'}</button>
    {result && <p className="invite-success" role="status">{result}</p>}
    {error && <p className="form-error" role="alert">{error}</p>}
  </details>
}
```

- [ ] **Step 4: Put the panel in the quest workspace**

In `frontend/src/pages/QuestDetailPage.tsx`, replace:

```tsx
import { useQuestRecommendations } from '../hooks/useQuestRecommendations'
```

with:

```tsx
import { useLiveQuestRecommendations } from '../hooks/useLiveQuestRecommendations'
import { useCrew } from '../hooks/useCrew'
import { CrewPanel } from '../components/crew/CrewPanel'
```

Replace:

```tsx
  const { data, error, retry } = useQuestRecommendations(roomId)
```

with:

```tsx
  const { data, error, retry } = useLiveQuestRecommendations(roomId)
  const { crew, refresh: refreshCrew } = useCrew(roomId)
  const refreshPlans = () => { retry(); refreshCrew() }
```

Replace:

```tsx
        <nav className="quest-planning-links" aria-label="Quest planning">
```

with:

```tsx
        <CrewPanel roomId={roomId} questName={quest.name} isOwner={quest.role === 'owner'} crew={crew} onChanged={refreshPlans} />
        <nav className="quest-planning-links" aria-label="Quest planning">
```

- [ ] **Step 5: Style the panel**

Add this to the end of `frontend/src/styles/crew.css`:

```css
.crew-panel { display: grid; gap: 1rem; margin-bottom: 1.5rem; padding: 1.25rem; border: 1px solid rgba(23, 50, 77, 0.12); border-radius: 20px; background: #fff; }
.crew-panel-heading { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 1rem; }
.crew-panel-heading h2 { margin: 0.2rem 0 0; }
.crew-members { display: flex; flex-wrap: wrap; gap: 0.5rem; margin: 0; padding: 0; list-style: none; }
.crew-members li { display: grid; gap: 0.1rem; padding: 0.5rem 0.8rem; border-radius: 12px; background: rgba(23, 50, 77, 0.05); }
.crew-members span { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.06em; }
.crew-members small { opacity: 0.75; }
.crew-clashes { margin: 0; padding: 0.75rem 1rem 0.75rem 1.75rem; border-radius: 12px; background: rgba(232, 96, 76, 0.08); }
.crew-share { display: grid; gap: 0.5rem; }
.crew-share label, .crew-note, .crew-chat-reader label { display: grid; gap: 0.35rem; font-weight: 600; }
.crew-share input, .crew-note input, .crew-chat-reader textarea { width: 100%; padding: 0.7rem 0.9rem; border: 1px solid rgba(23, 50, 77, 0.2); border-radius: 12px; font: inherit; }
.crew-share div { display: flex; flex-wrap: wrap; gap: 0.75rem; }
.crew-chat-reader { display: grid; gap: 0.6rem; }
.crew-chat-reader summary { cursor: pointer; font-weight: 600; }
.crew-answers { display: grid; gap: 1rem; }
.crew-answers fieldset { margin: 0; padding: 0; border: 0; }
.crew-answers legend { margin-bottom: 0.5rem; font-weight: 600; }
.crew-answers small, .crew-share small, .crew-note small, .crew-chat-reader small { font-weight: 400; opacity: 0.7; }
.crew-chips { display: flex; flex-wrap: wrap; gap: 0.5rem; }
.crew-chips button { min-height: 44px; padding: 0.5rem 0.9rem; border: 1px solid rgba(23, 50, 77, 0.25); border-radius: 999px; background: #fff; font: inherit; cursor: pointer; }
.crew-chips button[aria-pressed="true"] { border-color: #17324d; background: #17324d; color: #fff; }
.crew-from-chat { margin: 0; padding: 0.6rem 0.9rem; border-radius: 12px; background: rgba(23, 50, 77, 0.06); }
.crew-answered { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 0.75rem; }
.crew-answered p { margin: 0; }
```

- [ ] **Step 6: Lint, build, and check by hand**

Run: `npm --prefix frontend run lint && npm --prefix frontend run build`
Expected: both succeed.

Manual check:

1. As the organiser, open the quest and click **Share a join link**.
2. Open the link in a private window and join as Maya.
3. As Maya, choose Relaxation, Slow & relaxed, Moderate, and Hiking, then click **Save my answers**.

Expected: Maya sees "Your answers are in." Within 4 seconds, the organiser's panel shows Maya as **Answered**.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/hooks/useCrew.ts frontend/src/hooks/useLiveQuestRecommendations.ts frontend/src/components/crew/QuickAnswersForm.tsx frontend/src/components/crew/CrewPanel.tsx frontend/src/pages/QuestDetailPage.tsx frontend/src/styles/crew.css
git commit -m "feat: show the crew panel and quick answers in the quest workspace"
```

---

### Task 13: Fits, votes, typed changes, and the decided banner

**Files:**
- Create: `frontend/src/components/crew/MemberFits.tsx`
- Create: `frontend/src/components/crew/GoingButton.tsx`
- Create: `frontend/src/components/crew/DecidedBanner.tsx`
- Create: `frontend/src/components/crew/ChangeBox.tsx`
- Modify: `frontend/src/apis/quests.ts`
- Modify: `frontend/src/components/RecommendationCards.tsx`
- Modify: `frontend/src/components/crew/CrewPanel.tsx`
- Modify: `frontend/src/pages/QuestDetailPage.tsx`
- Modify: `frontend/src/styles/crew.css`

**Interfaces:**
- Consumes: Task 11 `MemberFit`, `Decision`, `sendChange`, and `voteForTrip`; Task 12 `useCrew` and `CrewPanel`.
- Produces:
  - `<MemberFits members stretch />`, which renders a region named "How this fits each person"
  - `<BlockedNotice blockers />`
  - `type CrewVoting = { votedFor: string | null; decidedId: string | null; onVote: (tripId: string) => Promise<void> }`
  - `<GoingButton tripId {...CrewVoting} />`, with button labels "We’re going", "You’re in for this one", and "It’s decided"
  - `<DecidedBanner decision questName />`, which renders a region named "Trip decided"
  - `<ChangeBox roomId onChanged />`, with the input label "Need a change?" and the button "Update the plans"
  - `RecommendationCards` accepts an optional `crewVoting` prop

- [ ] **Step 1: Add the new recommendation fields to the types**

In `frontend/src/apis/quests.ts`, replace:

```ts
const sessionKey = 'gotogether.session-token'
```

with:

```ts
const sessionKey = 'gotogether.session-token'
import type { MemberFit } from './crew'
```

Replace:

```ts
matchedPreferences: string[]; compromises: string[]; label: string }
```

with:

```ts
matchedPreferences: string[]; compromises: string[]; label: string; members?: MemberFit[]; groupScore?: number; minFit?: number; stretch?: boolean }
```

Replace:

```ts
request<{ travelDna: QuestDna | null; memberCount?: number; results: QuestRecommendation[] }>
```

with:

```ts
request<{ travelDna: QuestDna | null; memberCount?: number; results: QuestRecommendation[]; clashes?: string[]; blockers?: Array<'budget' | 'no-go'> }>
```

- [ ] **Step 2: Write the fit, vote, banner, and change components**

Create `frontend/src/components/crew/MemberFits.tsx`:

```tsx
import type { MemberFit } from '../../apis/crew'

export function MemberFits({ members, stretch }: { members: MemberFit[]; stretch?: boolean }) {
  if (!members.length) return null
  return <section className="crew-fits" aria-label="How this fits each person">
    <p className="eyebrow">HOW IT FITS EVERYONE</p>
    <ul>{members.map((member) => <li key={member.userId}>
      <div><strong>{member.name}</strong><span>{member.reason}</span></div>
      <meter min={0} max={100} value={member.fit} aria-label={`${member.name}: ${member.fit} out of 100`} />
      <b>{member.fit}%</b>
    </li>)}</ul>
    {stretch && <p className="crew-stretch">Nothing fits everyone comfortably yet — this is the closest. A typed change might open better options.</p>}
  </section>
}

export function BlockedNotice({ blockers }: { blockers: Array<'budget' | 'no-go'> }) {
  const reasons = blockers.map((blocker) => blocker === 'budget' ? 'a budget limit' : 'a no-go').join(' and ')
  return <div className="crew-blocked" role="status">
    <h3>No trip fits everyone’s limits yet.</h3>
    <p>Every option is ruled out by {reasons}. Try relaxing one of your own limits — for example “I’m fine with hiking” — or update your answers.</p>
  </div>
}
```

Create `frontend/src/components/crew/GoingButton.tsx`:

```tsx
import { useState } from 'react'

export type CrewVoting = { votedFor: string | null; decidedId: string | null; onVote: (tripId: string) => Promise<void> }

export function GoingButton({ tripId, votedFor, decidedId, onVote }: CrewVoting & { tripId: string }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const mine = votedFor === tripId
  const vote = async () => {
    if (busy || mine) return
    setBusy(true); setError('')
    try { await onVote(tripId) } catch (reason) { setError(reason instanceof Error ? reason.message : 'We couldn’t save your vote. Please try again.') } finally { setBusy(false) }
  }
  const label = decidedId === tripId ? 'It’s decided' : mine ? 'You’re in for this one' : busy ? 'Saving your vote…' : 'We’re going'
  return <div className="crew-going">
    <button type="button" className="primary-button" aria-pressed={mine} disabled={busy} onClick={() => void vote()}>{label}</button>
    {error && <p className="form-error" role="alert">{error}</p>}
  </div>
}
```

Create `frontend/src/components/crew/DecidedBanner.tsx`:

```tsx
import type { Decision } from '../../apis/crew'

export function DecidedBanner({ decision, questName }: { decision: Decision; questName: string }) {
  const minutes = `${decision.minutesToDecide} ${decision.minutesToDecide === 1 ? 'minute' : 'minutes'}`
  const message = `We’re going: ${decision.title}! Decided together in ${minutes} on Go.Together.`
  return <section className="crew-decided" aria-label="Trip decided">
    <p className="eyebrow">IT’S DECIDED</p>
    <h2>{decision.title}</h2>
    <p role="status">{questName} chose together in {minutes}{decision.lowestFit !== null ? ` · nobody below a ${decision.lowestFit}% fit` : ''}.</p>
    <a className="primary-button" href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer">Share on WhatsApp</a>
  </section>
}
```

Create `frontend/src/components/crew/ChangeBox.tsx`:

```tsx
import { useState, type FormEvent } from 'react'
import { sendChange } from '../../apis/crew'

export function ChangeBox({ roomId, onChanged }: { roomId: string; onChanged: () => void }) {
  const [text, setText] = useState('')
  const [summary, setSummary] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (busy || !text.trim()) return
    setBusy(true); setError(''); setSummary('')
    try { setSummary((await sendChange(roomId, text)).summary); setText(''); onChanged() }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'We couldn’t make that change. Please try again.') }
    finally { setBusy(false) }
  }
  return <form className="crew-change" onSubmit={submit}>
    <label htmlFor="crew-change">Need a change?<input id="crew-change" value={text} maxLength={300} onChange={(event) => setText(event.target.value)} placeholder="“I can’t do hikes” or “make it cheaper”" /></label>
    <button className="text-button" type="submit" disabled={busy || !text.trim()}>{busy ? 'Updating…' : 'Update the plans'}</button>
    {summary && <p className="invite-success" role="status">{summary}</p>}
    {error && <p className="form-error" role="alert">{error}</p>}
  </form>
}
```

- [ ] **Step 3: Show fits and the vote button on the selected trip**

In `frontend/src/components/RecommendationCards.tsx`, replace:

```tsx
import { photoFallback, recommendationPhoto } from '../services/itineraryPresentation'
```

with:

```tsx
import { photoFallback, recommendationPhoto } from '../services/itineraryPresentation'
import { MemberFits } from './crew/MemberFits'
import { GoingButton, type CrewVoting } from './crew/GoingButton'
```

Replace:

```tsx
type Props = { results: QuestRecommendation[]; roomId: string; travelDna?: QuestDna | null; workspace?: boolean; onDiscuss?: (context: ChatContext) => void }
export function RecommendationCards({ results, roomId, travelDna, workspace = false, onDiscuss }: Props) {
```

with:

```tsx
type Props = { results: QuestRecommendation[]; roomId: string; travelDna?: QuestDna | null; workspace?: boolean; onDiscuss?: (context: ChatContext) => void; crewVoting?: CrewVoting }
export function RecommendationCards({ results, roomId, travelDna, workspace = false, onDiscuss, crewVoting }: Props) {
```

Replace:

```tsx
    {selected && <div className="itinerary-selection" ref={storyRef} tabIndex={-1}><ItineraryStory
```

with:

```tsx
    {selected && <div className="itinerary-selection" ref={storyRef} tabIndex={-1}>{crewVoting && <div className="crew-fit-panel"><MemberFits members={selected.members ?? []} stretch={selected.stretch} /><GoingButton tripId={selected.id} {...crewVoting} /></div>}<ItineraryStory
```

- [ ] **Step 4: Add the change box to the crew panel**

In `frontend/src/components/crew/CrewPanel.tsx`, replace:

```tsx
import { QuickAnswersForm } from './QuickAnswersForm'
```

with:

```tsx
import { QuickAnswersForm } from './QuickAnswersForm'
import { ChangeBox } from './ChangeBox'
```

Replace:

```tsx
    <ChatReader roomId={roomId} onRead={refreshMine} />
```

with:

```tsx
    <ChatReader roomId={roomId} onRead={refreshMine} />
    <ChangeBox roomId={roomId} onChanged={refreshMine} />
```

- [ ] **Step 5: Wire voting, the banner, and the blocked notice into the workspace**

In `frontend/src/pages/QuestDetailPage.tsx`, replace:

```tsx
import { CrewPanel } from '../components/crew/CrewPanel'
```

with:

```tsx
import { CrewPanel } from '../components/crew/CrewPanel'
import { DecidedBanner } from '../components/crew/DecidedBanner'
import { BlockedNotice } from '../components/crew/MemberFits'
import { voteForTrip } from '../apis/crew'
import { useAuth } from '../auth/AuthContext'
```

Replace:

```tsx
  const refreshPlans = () => { retry(); refreshCrew() }
```

with:

```tsx
  const refreshPlans = () => { retry(); refreshCrew() }
  const { user } = useAuth()
  const myVote = crew?.members.find((member) => member.userId === user?.id)?.votedFor ?? null
  const vote = async (tripId: string) => { await voteForTrip(roomId, tripId); refreshPlans() }
```

Replace:

```tsx
    <div className="quest-workspace-grid" ref={workspace}>
```

with:

```tsx
    {crew?.decided && <DecidedBanner decision={crew.decided} questName={quest.name} />}
    <div className="quest-workspace-grid" ref={workspace}>
```

Replace:

```tsx
data.results.length ? <RecommendationCards results={data.results} roomId={roomId} travelDna={data.travelDna} workspace onDiscuss={discuss} /> : <EmptyState
```

with:

```tsx
data.results.length ? <RecommendationCards results={data.results} roomId={roomId} travelDna={data.travelDna} workspace onDiscuss={discuss} crewVoting={{ votedFor: myVote, decidedId: crew?.decided?.itineraryId ?? null, onVote: vote }} /> : data.blockers?.length ? <BlockedNotice blockers={data.blockers} /> : <EmptyState
```

- [ ] **Step 6: Style the new parts**

Add this to the end of `frontend/src/styles/crew.css`:

```css
.crew-change { display: grid; gap: 0.5rem; }
.crew-change label { display: grid; gap: 0.35rem; font-weight: 600; }
.crew-change input { width: 100%; padding: 0.7rem 0.9rem; border: 1px solid rgba(23, 50, 77, 0.2); border-radius: 12px; font: inherit; }
.crew-fit-panel { display: grid; gap: 1rem; margin-bottom: 1.25rem; padding: 1rem 1.25rem; border-radius: 18px; background: rgba(23, 50, 77, 0.04); }
.crew-fits ul { display: grid; gap: 0.6rem; margin: 0.5rem 0 0; padding: 0; list-style: none; }
.crew-fits li { display: grid; grid-template-columns: 1fr minmax(80px, 160px) 3.5rem; align-items: center; gap: 0.75rem; }
.crew-fits li div { display: grid; }
.crew-fits li span { font-size: 0.9rem; opacity: 0.8; }
.crew-fits meter { width: 100%; height: 0.6rem; }
.crew-fits b { text-align: right; }
.crew-stretch, .crew-blocked { padding: 0.75rem 1rem; border-radius: 12px; background: rgba(232, 96, 76, 0.08); }
.crew-decided { display: grid; gap: 0.5rem; justify-items: start; margin-bottom: 1.25rem; padding: 1.25rem 1.5rem; border-radius: 20px; background: #17324d; color: #fff; }
.crew-decided h2 { margin: 0; }
@media (max-width: 600px) { .crew-fits li { grid-template-columns: 1fr 3rem; } .crew-fits meter { grid-column: 1 / -1; } }
```

- [ ] **Step 7: Lint, build, and check by hand**

Run: `npm --prefix frontend run lint && npm --prefix frontend run build`
Expected: both succeed.

Manual check, with the organiser and Maya both answered:

1. On the selected trip, both see "How it fits everyone" with two rows.
2. Maya types `I can’t do late nights` and clicks **Update the plans**. She sees "Added to your no-gos: Late nights."
3. Both click **We’re going** on the same trip.

Expected: both see the "It’s decided" banner with minutes and the lowest fit, and **Share on WhatsApp** opens `wa.me` with the message.

Then check the blocked state (Review Focus 4):

1. Type `nobody wants hiking, water, late nights, early starts, crowds, remote or walking`.
   Expected: the workspace shows "No trip fits everyone’s limits yet." instead of an empty page.
2. Type `we’re fine with hiking, water, late nights, early starts, crowds, remote and walking`.
   Expected: the plans come back.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/components/crew/MemberFits.tsx frontend/src/components/crew/GoingButton.tsx frontend/src/components/crew/DecidedBanner.tsx frontend/src/components/crew/ChangeBox.tsx frontend/src/apis/quests.ts frontend/src/components/RecommendationCards.tsx frontend/src/components/crew/CrewPanel.tsx frontend/src/pages/QuestDetailPage.tsx frontend/src/styles/crew.css
git commit -m "feat: show each person's fit, typed changes, votes, and the decided trip"
```

---

### Task 14: Browser check for the crew flow

**Files:**
- Create: `frontend/tools/check-crew.mjs`
- Modify: `frontend/tools/check-journey.mjs`

**Interfaces:**
- Consumes: the UI names from Tasks 11–13.
  - Labels: "What should the crew call you?" and "Need a change?"
  - Buttons: "Join the quest", "Save my answers", "Update the plans", and "We’re going".
  - The "My quick answers" form, and the regions "Your crew", "How this fits each person", and "Trip decided".
- Produces: `checkCrew(page, { base, roomId, out, check })`.

- [ ] **Step 1: Write the check**

Create `frontend/tools/check-crew.mjs`:

```js
import assert from 'node:assert/strict'

export async function checkCrew(page, { base, roomId, out, check }) {
  const ownerToken = await page.evaluate(() => localStorage.getItem('gotogether.session-token'))
  const created = await page.request.post(`${base}/api/trip-rooms/${roomId}/links`, { headers: { Authorization: `Bearer ${ownerToken}` } })
  assert.equal(created.status(), 201)
  const joinPath = new URL((await created.json()).data.url).pathname
  const friendContext = await page.context().browser().newContext({ viewport: { width: 390, height: 844 } })
  const friend = await friendContext.newPage()
  const errors = []
  friend.on('pageerror', (error) => errors.push(error.message))
  friend.setDefaultTimeout(12000)
  try {
    await friend.goto(`${base}${joinPath}`)
    await friend.getByLabel('What should the crew call you?').fill('Maya')
    await friend.getByRole('button', { name: 'Join the quest' }).click()
    await friend.waitForURL(`**/quests/${roomId}`)
    const form = friend.getByRole('form', { name: 'My quick answers' })
    for (const label of ['Relaxation', 'Wellness', 'Slow & relaxed', 'Moderate', 'Hiking']) await form.getByRole('button', { name: label, exact: true }).click()
    await form.getByRole('button', { name: 'Save my answers' }).click()
    await friend.getByText('Your answers are in.', { exact: false }).waitFor()
    await friend.screenshot({ path: `${out}/40-crew-friend-answers.png` })
    check('A friend joins from a share link with only a name and saves four quick answers')

    await page.goto(`${base}/quests/${roomId}`)
    await page.getByRole('region', { name: 'Your crew' }).getByText('Maya', { exact: true }).waitFor()
    await page.getByRole('region', { name: 'How this fits each person' }).getByText('Maya', { exact: true }).waitFor()
    await page.screenshot({ path: `${out}/41-crew-owner-fits.png` })
    check('The organiser sees the friend in the crew and their fit on the selected trip')

    await friend.getByLabel('Need a change?').fill('I can’t do late nights')
    await friend.getByRole('button', { name: 'Update the plans' }).click()
    await friend.getByText('Added to your no-gos: Late nights.').waitFor()
    check('A typed change is understood and confirmed to the person who typed it')

    await friend.reload()
    await page.reload()
    await page.getByRole('button', { name: 'We’re going' }).click()
    await friend.getByRole('button', { name: 'We’re going' }).click()
    await friend.getByRole('region', { name: 'Trip decided' }).waitFor()
    await page.getByRole('region', { name: 'Trip decided' }).waitFor({ timeout: 15000 })
    assert.equal(await page.getByRole('link', { name: 'Share on WhatsApp' }).getAttribute('target'), '_blank')
    await page.screenshot({ path: `${out}/42-crew-decided.png` })
    check('When everyone picks the same trip, both see it decided with a WhatsApp share link')
    assert.deepEqual(errors, [], 'Crew browser runtime errors')
  } catch (error) {
    await friend.screenshot({ path: `${out}/crew-failure.png` })
    throw error
  } finally {
    await friendContext.close()
  }
}
```

- [ ] **Step 2: Wire it into the journey check**

In `frontend/tools/check-journey.mjs`, replace:

```js
import { checkInvitations } from './check-invitations.mjs'
```

with:

```js
import { checkInvitations } from './check-invitations.mjs'
import { checkCrew } from './check-crew.mjs'
```

and replace:

```js
  await checkInvitations(page, { base, roomId, password, out, check })
```

with:

```js
  await checkInvitations(page, { base, roomId, password, out, check })
  await checkCrew(page, { base, roomId, out, check })
```

- [ ] **Step 3: Run the browser check**

Run:

```bash
docker compose -f backend/tests/docker-compose.yml up -d --wait
npm --prefix backend run build
npm --prefix frontend run test:journey
```

Expected: every existing check passes, plus the four new crew checks. Screenshots `40-`, `41-`, and `42-` are written to `frontend/.journey-test-results/`.

- [ ] **Step 4: Commit**

```bash
git add frontend/tools/check-crew.mjs frontend/tools/check-journey.mjs
git commit -m "test: browser-check the share link to decision flow"
```

---

### Task 15: Demo reset, docs, and a Docker run-through

**Files:**
- Create: `backend/src/scripts/demoReset.ts`
- Create: `database/seeds/demo-group-chat.txt`
- Modify: `backend/package.json` (scripts)
- Modify: `README.md`

**Interfaces:**
- Consumes: `applyMigrations`, `seedCatalogue`, `registerUser`, `loginUser`, `createRoom`, and `createShareLink`.
- Produces: `npm run demo:reset`. It prints the organiser's sign-in details, the quest URL, and a fresh join link.

- [ ] **Step 1: Write the demo reset script**

Create `backend/src/scripts/demoReset.ts`:

```ts
import '../environment.js'
import { getDatabaseConfig } from '../databaseConfig.js'
import { applyMigrations } from '../migrations.js'
import { seedCatalogue } from '../services/catalogueSeed.js'
import { loginUser, registerUser } from '../services/authService.js'
import { createRoom } from '../services/roomService.js'
import { createShareLink } from '../services/shareLinkService.js'
import { closeDatabase, deleteRows, selectRows } from '../storage.js'

const DEMO_EMAIL = 'demo.organiser@gotogether.test'
const DEMO_PASSWORD = 'Go together demo 2026!'

async function reset() {
  const config = getDatabaseConfig()
  if (config.provider !== 'postgres' || !/@(localhost|127\.0\.0\.1|db):/.test(config.connectionString)) throw new Error('demo:reset only runs against the local Docker or localhost Postgres database.')
  await applyMigrations()
  await seedCatalogue()
  const [existing] = await selectRows<{ id: string }>('users', ['id'], [{ column: 'email', operator: 'eq', value: DEMO_EMAIL }])
  if (existing) {
    const owned = await selectRows<{ trip_room_id: string }>('trip_room_people', ['trip_room_id'], [{ column: 'user_id', operator: 'eq', value: existing.id }, { column: 'role', operator: 'eq', value: 'owner' }])
    const roomIds = owned.map((row) => row.trip_room_id)
    if (roomIds.length) {
      const people = await selectRows<{ user_id: string }>('trip_room_people', ['user_id'], [{ column: 'trip_room_id', operator: 'in', value: roomIds }])
      const guests = await selectRows<{ id: string }>('users', ['id'], [{ column: 'id', operator: 'in', value: people.map((row) => row.user_id) }, { column: 'is_guest', operator: 'eq', value: 'true' }])
      await deleteRows('trip_rooms', [{ column: 'id', operator: 'in', value: roomIds }])
      if (guests.length) await deleteRows('users', [{ column: 'id', operator: 'in', value: guests.map((row) => row.id) }])
    }
  }
  const organiser = existing ? await loginUser(DEMO_EMAIL, DEMO_PASSWORD) : await registerUser({ firstName: 'Alex', lastName: 'Rivera', email: DEMO_EMAIL, password: DEMO_PASSWORD })
  const room = await createRoom({ name: 'Long weekend, finally', tripName: 'Somewhere good', members: 3, ownerId: organiser.user.id })
  const link = await createShareLink(room.id, organiser.user.id)
  const app = (process.env.APP_URL ?? 'http://localhost:5173').replace(/\/$/, '')
  console.log(`Demo ready.\n  Organiser: ${DEMO_EMAIL} / ${DEMO_PASSWORD}\n  Quest: ${app}/quests/${room.id}\n  Join link: ${link.url}\n  Sample chat to paste: database/seeds/demo-group-chat.txt`)
}

reset()
  .catch((error: unknown) => { console.error(error instanceof Error ? error.message : 'Demo reset failed.'); process.exitCode = 1 })
  .finally(() => closeDatabase())
```

- [ ] **Step 2: Add the sample chat and the script entry**

Create `database/seeds/demo-group-chat.txt`:

```text
[07/10/2026, 19:02:11] Alex Rivera: Ok we HAVE to actually book something this time 😅
[07/10/2026, 19:03:40] Maya: I’d love a slow beach week with good food. No hiking please, my knee is still bad
[07/10/2026, 19:04:02] Rohan: I want adventure! Rafting, mountains, the works. Happy to splurge a bit
[07/10/2026, 19:05:15] Maya: honestly money is a bit tight for me this month
[07/10/2026, 19:06:30] Alex Rivera: I’m easy, just want great food and a bit of culture
```

In `backend/package.json`, replace:

```json
    "test:one": "node tests/run-one.mjs"
```

with:

```json
    "test:one": "node tests/run-one.mjs",
    "demo:reset": "tsx src/scripts/demoReset.ts"
```

- [ ] **Step 3: Document the demo and hosting step**

In `README.md`, add this section after the existing Docker section:

````markdown
## Group decision demo

```bash
docker compose up --build -d
docker compose exec backend npm run demo:reset
```

`demo:reset` prints the organiser's sign-in details, the quest URL, and a fresh join link. Open the join link in two private windows as **Maya** and **Rohan**. As the organiser, open **Read our chat for wishes** and paste `database/seeds/demo-group-chat.txt`, so each friend's answers are pre-filled when they join.

Hosted Supabase: run `database/migrations/004_group_decision.sql` in the SQL editor **before** deploying this backend. Sign-in reads the new `users.is_guest` column.
````

- [ ] **Step 4: Run it end to end in Docker**

Run:

```bash
docker compose up --build -d
docker compose logs backend --tail 20
docker compose exec -T db psql -U gotogether -d gotogether -At -c "select count(*), count(*) filter (where jsonb_array_length(activity_tags) > 0) from itinerary_catalogue;"
docker compose exec backend npm run demo:reset
```

Expected:
- The logs show `Checked 4 database migrations.` and `GoTogether API listening`.
- The `psql` query prints `72|` followed by a non-zero tagged count.
- `demo:reset` prints the organiser's details and a join link.

- [ ] **Step 5: Rehearse the three-minute demo**

Use three browser profiles: Organiser, Maya, and Rohan.

1. The organiser signs in and opens the quest. They paste the sample chat into **Read our chat for wishes** and click **Read our chat**. It shows "Picked up wishes for Alex, Maya, Rohan."
2. Maya and Rohan open the join link, enter their names, and see "From the chat" pre-filled. Each saves their answers.
3. The organiser sees **3 of 3 have answered**, plus the clash note "Budgets vary a lot — every plan stays within the tightest one."
4. On the selected trip, all three people's fits are shown, and no reason mentions budgets or no-gos.
5. Maya types `I can’t do late nights`. The plans re-rank within 4 seconds.
6. All three click **We’re going** on the same trip. The banner shows the trip, minutes to decide, the lowest fit, and **Share on WhatsApp**.

Run `docker compose exec backend npm run demo:reset` between rehearsals. Record a backup video of one clean run.

- [ ] **Step 6: Commit**

```bash
git add backend/src/scripts/demoReset.ts database/seeds/demo-group-chat.txt backend/package.json README.md
git commit -m "chore: add a one-command demo reset and document the group demo"
```
