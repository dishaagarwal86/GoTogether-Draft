# Group decision: from group chat to a plan everyone accepts

Date: 2026-10-06
Status: approved; amended 2026-10-07 with private needs and decisions made while planning
Base commit: `8c55b75` (journey redesign and invitation inbox merged)

## Goal

A group of friends goes from "we should go somewhere" to one trip that everyone has accepted, without anyone having to explain their budget, health, or mobility limits to the others: *a trip everyone can say yes to, without anyone having to explain why.*

The demo succeeds when two friends join from a link and answer in under a minute each, the plans show every person's fit, a typed change re-ranks the plans, and the quest is marked decided.

## People

- **Organiser:** signed-in account. Creates the quest, shares the link, can paste a chat from outside the app.
- **Friend:** joins from a link with only a name (a guest). Answers four quick questions and votes.

## Scope

In scope: share link and guest join; quick answers; chat-to-answers suggestions; catalogue activity tags and seeding on start-up; per-person scoring with hard limits; typed changes; voting and a decided state; database migrations on start-up for Postgres.

Out of scope: booking, flights, hotels, payments, bill splitting, changes during the trip, live inventory, changes to email invites, upgrading a guest to a full account.

## Fixed vocabularies

All AI output and form input is validated against these lists. Anything else is dropped.

- **Feelings** (up to three): Adventure, Food & Culture, Relaxation, Nature, Nightlife, Wellness. These match the catalogue's `moods`.
- **Pace** (one): Slow & relaxed, A balanced mix, Busy & activity-filled. These match the catalogue's `ai_context.pace`.
- **Budget band** (one, private): Budget-friendly, Moderate, Premium, Flexible.
- **No-gos** (any, private): `hiking`, `water-activities`, `late-nights`, `early-starts`, `big-crowds`, `remote-places`, `lots-of-walking`, shown as Hiking, Water activities, Late nights, Early starts, Big crowds, Remote places, Lots of walking.

## Private needs

Budget bands and no-gos are private needs. They act as hard limits on every plan but are never attributed to anyone:

- Reasons never mention a budget band or a no-go.
- Clash notes never name anyone.
- The crew status never includes anyone's band or no-gos.
- A member only ever receives their own chat suggestion.

Walking levels come from the synthetic catalogue's descriptions, so they're an estimate. Real use needs proper accessibility data.

## Data changes

New migration `database/migrations/004_group_decision.sql`. Every statement is idempotent (`if not exists`).

- New table `trip_room_links`: `id` text primary key, `trip_room_id` (cascade delete), `token_hash` unique, `created_by` (users), `expires_at`, `revoked_at` nullable, `created_at`.
- New table `trip_room_votes`: `trip_room_id` (cascade delete), `user_id` (cascade delete), `itinerary_id`, `created_at`, `updated_at`, primary key (`trip_room_id`, `user_id`).
- `trip_rooms`: add `chat_suggestions` jsonb, `group_limits` jsonb default `'{}'`, `decided_itinerary_id` text, `decided_at` timestamptz.
- `users`: add `is_guest` boolean not null default false.
- `itinerary_catalogue`: add `activity_tags` jsonb not null default `'[]'`.
- `preferences`: no schema change. Quick answers use `mood_preferences` (feelings), `budget` (band), and `data.pace`, `data.noGoTags`, `data.note`, `data.source = 'quick'`. Code keeps one row per member per quest by updating the existing row when there is one.
- `backend/src/storage.ts`: register the two new tables, and add `chat_suggestions`, `group_limits`, and `activity_tags` to the JSON columns.

## Catalogue tags and seeding

The seed logic moves into `backend/src/services/catalogueSeed.ts` as `seedCatalogue()`. The existing `npm run seed:catalogue` script calls it, and the backend calls it on every start-up. It only inserts trips that are missing, and fills in tags for existing trips that have none.

Tags per trip:

- `hiking`: location is Mountains, the anchors mention trail, hike, walk, or ridge, or the primary mood is Adventure.
- `water-activities`: location is Beach or Islands, or the anchors mention swim, surf, reef, lagoon, sailing, boat, or pool.
- `late-nights`: the moods include Nightlife.
- `early-starts`: the anchors mention sunrise, morning, alms, or balloon, or the pace is Busy & activity-filled.
- `big-crowds`: location is City.
- `remote-places`: location is Hidden gems, or the anchors mention remote.
- `lots-of-walking`: the trip has the `hiking` tag, or the anchors mention walk, lanes, streets, paths, or ruins.

## Migrations on start-up

In Postgres mode, before the server starts listening, the backend applies every file in `database/migrations` in name order, each in its own transaction. Supabase mode is unchanged: new SQL is run in the SQL editor.

## Joining

- `POST /api/trip-rooms/:roomId/links` (owner only) returns `{ id, url, expiresAt }`. The token is 32 random bytes in hex, stored as a SHA-256 hash, and expires after 7 days. The URL is `APP_URL/join/<token>` and is only returned at creation.
- `DELETE /api/trip-rooms/:roomId/links/:linkId` (owner only) sets `revoked_at` and returns 204.
- `GET /api/join/:token` (public) returns `{ room: { id, name }, organiserName, expiresAt }`, or 404 when the link is missing, expired, or revoked.
- `POST /api/join/:token` with `{ name }` (1–40 characters):
  - Signed in: adds an accepted membership and returns `{ roomId }`.
  - Not signed in: creates a user with `first_name = name` and `is_guest = true`, an accepted membership, and a session, then returns `{ roomId, token, user }`. The front end stores this token like any other session.

## Quick answers

- `GET /api/trip-rooms/:roomId/answers/me` (member) returns `{ answers, suggestion }`. Either can be null.
- `PUT /api/trip-rooms/:roomId/answers/me` (member) validates against the vocabularies, saves, and returns the answers.

When a member has no saved answers yet, the form is pre-filled from their chat suggestion and labelled "From the chat" until they save.

## Chat to suggestions

`POST /api/trip-rooms/:roomId/chat-suggestions` (member), with optional `{ pastedText }`:

1. Reads up to 200 quest messages with their sender ids, plus pasted lines in the form `Name: message`.
2. Asks the configured AI provider for each person's `{ name, feelings, pace, budgetBand, noGo, note }`. Values outside the vocabularies are dropped. With no provider, or on any error, a keyword matcher is used instead.
3. Matches quest messages to members by sender id, and pasted names to members by first name, ignoring case. Unmatched names are kept and offered to a guest who later joins with that name.
4. Stores `{ generatedAt, source: 'ai' | 'keywords', people }` in `trip_rooms.chat_suggestions`.

A member only ever receives their own suggestion, because it can contain budget hints.

## Scoring

Pure functions in `backend/src/services/groupScoring.ts`. Inputs: members with saved answers, group limits, and catalogue rows.

**Each person's fit** (0–100) = 50 × mood + 30 × pace + 20 × note:

- mood = matched feelings ÷ feelings chosen, or 0.6 if none chosen.
- pace = 1 for an exact match, 0.5 for the neighbouring pace, 0 for the opposite pace, or 0.6 if unknown.
- note = 1 if any word of four or more letters in the note appears in the trip's highlights or short description, 0 if none does, or 0.5 if there is no note.

**Hard limits** remove a trip when its budget band is above any member's band (Flexible or missing means no limit), or when its `activity_tags` include any member's no-go. Group limits apply the same way.

**Group score** = the geometric mean of the member fits, each floored at 1, rounded.

**Minimum fit** is 40. Eligible trips pass every hard limit and keep every member at 40 or above. If none qualify, trips that pass the hard limits are used and marked `stretch: true`. If no trip passes the hard limits, the response has no results and lists `blockers` (`budget`, `no-go`) without naming anyone.

**The three paths:**

- **Best shared fit:** highest group score. Ties go to the higher minimum fit, then the lower id.
- **Fair compromise:** highest minimum fit among the remaining trips. Ties go to the higher group score.
- **Unexpected discovery:** highest group score among the remaining trips with location type Hidden gems, or otherwise the next best remaining trip.

Each path lists `members: [{ userId, name, fit, reason }]`. Reasons never mention a budget band or a no-go:

- Feelings and pace both match: "Relaxation and Wellness, at a slow pace"
- Feelings only: "Relaxation and Wellness"
- Pace only: "Right pace: slow & relaxed"
- Neither: "Not their top pick, but nothing on their no-go list"

**Clash notes** appear only once at least two members have answered, and never name anyone:

- Budget bands two steps apart: "Budgets vary a lot — every plan stays within the tightest one."
- Both Slow & relaxed and Busy & activity-filled chosen: "Some want slow days and some want busy ones — plans balance both."
- No feeling shared by at least two members: "No shared trip feeling yet — the unexpected pick is worth a look."

`GET /api/recommendations/quests/:roomId` now requires membership. It keeps its current fields (`memberCount`, `travelDna`, and `results` with `label`, `score`, `matchedPreferences`, `compromises`). On each result, `score` becomes the group score and `matchedPreferences` the matched feelings. It adds `groupScore`, `minFit`, `stretch`, and `members` per result, plus `clashes` and `blockers`. Members without saved answers are not counted.

## Typed changes

`POST /api/trip-rooms/:roomId/changes` (member) with `{ text }` turns the text into `{ target: 'me' | 'group', addNoGo, removeNoGo, budgetBand, pace, addFeelings }`. Keyword rules run first, so the demo stays fast and predictable; the AI provider is used only when they find nothing. It applies the change to the sender's own answers (`me`) or to the group limits (`group`, which only accepts a budget band and no-gos), and returns `{ summary, source }`.

Keyword rules:

- A negative word (can't, cannot, no, nobody, don't, avoid, hate, not, never, skip, without) in the same text as a no-go keyword adds that no-go. "Fine with", "okay with", "happy to", or "can do" next to a no-go keyword removes it.
- "cheaper" or "lower budget" lowers the sender's band by one step. Flexible becomes Moderate.
- "slower" or "more relaxed" sets Slow & relaxed. "busier" or "more active" sets Busy & activity-filled.
- "we", "everyone", or "nobody" targets the group.

Text that can't be parsed returns 422 with "I couldn't turn that into a change — try 'no hiking' or 'cheaper'."

## Deciding

- `PUT /api/trip-rooms/:roomId/vote` (member) with `{ itineraryId }` saves the member's vote. When every member who has saved answers has voted for the same trip, the quest records `decided_itinerary_id` and `decided_at`. Returns `{ decided }`, which is null or `{ itineraryId, title, decidedAt, minutesToDecide, lowestFit }`. `minutesToDecide` counts from the first share link (or from when the quest was created, if there is no link). If a vote later breaks the agreement, the decision is cleared. Members without saved answers (for example, someone who joined twice from a new phone) don't block a decision.
- `GET /api/trip-rooms/:roomId/crew` (member) returns `{ members: [{ userId, name, role, isGuest, answered, votedFor }], clashes, decided }`. It never includes budgets.

## Front end

The existing invite page, invitation inbox, and quest chat stay as they are; the join page is a separate route for share links.

New files:

- `pages/JoinPage.tsx`
- `components/crew/CrewPanel.tsx`
- `components/crew/QuickAnswersForm.tsx`
- `components/crew/MemberFits.tsx`
- `components/crew/ChangeBox.tsx`
- `components/crew/GoingButton.tsx`
- `components/crew/DecidedBanner.tsx`
- `hooks/useCrew.ts` and `hooks/useLiveQuestRecommendations.ts`
- `styles/crew.css`
- `apis/crew.ts`

Small edits to existing files:

- `AppShell.tsx`: add the `/join/:token` route.
- `App.tsx`: import `styles/crew.css`.
- `AuthContext.tsx`: accept a session token returned by joining.
- `apis/quests.ts`: add the new recommendation fields to its types.
- `QuestDetailPage.tsx`: show the crew panel, the quick-answers form, the decided banner, and a notice when limits block every trip.
- `RecommendationCards.tsx`: show each member's fit and the "We're going" button.

The crew panel and the recommendations refresh every 4 seconds. Once the quest is decided, a banner shows the trip, minutes to decide, the lowest fit, and a WhatsApp share link (`https://wa.me/?text=…`).

## Errors

- **AI unavailable or invalid JSON:** fall back to keywords. The response has `source: 'keywords'`, and the chat-reading result is labelled "basic matching".
- **Link missing, expired, or revoked:** 404. The join page explains this and links home.
- **Not a member:** 403. Not the owner, for link actions: 403.
- **Invalid input:** 400 with a plain message.

## Testing

- **Unit tests** with `node:test`:
  - Scoring: hard limits, geometric-mean ranking, three distinct paths, the minimum fit and `stretch`, `blockers`, reasons that never mention budget, and clash notes that never name anyone.
  - The keyword parsers for chats and for typed changes.
  - Tag derivation.
- **Provider integration test** on both databases, using the existing runner: the owner creates a quest and a link, two guests join and save answers, recommendations show three paths with each member's fit, the change "no hiking" removes hiking trips, both members vote for the same trip, and the quest is decided.
- **Manual check:** `docker compose up --build` on an existing volume applies `004` and seeds 72 trips.

## Coordination and hosting

- The journey redesign and the invitation inbox are committed on `main`. Email invites, the inbox, and `POST /api/invites/:id/join` stay unchanged.
- New work goes into new files. Edits to existing files are limited to the small changes listed above, so they merge cleanly with teammates' work.
- The hosted front end (Vercel) builds join links from `APP_URL`, the same setting email invites already use.
- A hosted Supabase database needs `004_group_decision.sql` run in its SQL editor before the new backend is deployed. Seeding on start-up works with both database providers.
