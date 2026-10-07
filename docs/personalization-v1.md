# Travel memory and workflow integration — v1

Implemented locally on the trip workspace branch, 7 October 2026. This document describes source behavior, not deployment status. The broader [personalization design](superpowers/specs/2026-10-07-travel-personalization-design.md) remains a roadmap.

## A continuous workflow

1. Start with a short trip idea. Returning travellers see matching remembered preferences and can turn them off for this trip. Context choices distinguish leisure, solo, partner, friends, family, and work.
2. Shape the saved itinerary directly: edit, drag, move, lock, add, remove, undo. Relevant edits offer an optional inline **Remember this / Just this trip** choice. No confirmation is needed to finish the itinerary edit itself.
3. Open **Companion → Edit the plan** beside the current day. Submit a bounded request, inspect before/after changes, then apply or keep the current plan. Existing private chat stays in **Talk it through**; Crew remains shared.
4. Find **My travel style** through the account menu, profile, quick start, or travel book. Correct or forget a preference; pause learning suggestions/use; reset all memories.
5. Open **Past chapters** from the travel book or style page. Paste an itinerary, review editable day cards, reflect on what actually happened, and optionally remember interests. Draft reviews autosave after 600 ms; wait for the saved indicator before navigating away. **Back to chapters** flushes the current review before leaving.
6. A successful contribution links directly to **Little perks**. Redeemed planning credits are visible in Companion. No import, reward or memory step gates ordinary planning.

The UI uses the existing canvas, illustrated backgrounds, day cards, icons, responsive sheets and account navigation. A phone uses the same workflows with a reachable planning panel and tap alternatives to dragging.

## What personalizes a later trip

The first rules suggest later/earlier morning starts, interests from selected additions, and avoiding hikes after removal. Suggestions are private, never automatically promoted into preferences, and tied to the actual saved revision. Confirmation chooses a context or all trips. Undo reverses the source evidence; deleting an imported chapter removes its memories. Reset also removes old edit signals so an old nudge cannot recreate a forgotten profile.

Specific-context facts override all-trip defaults, with the latest confirmation winning within a scope. Explicit day-start, pace and interest answers override defaults. Confirmed activities to avoid constrain matching until corrected or memories are disabled for the trip. New unbooked template days may shift to the remembered start while preserving gaps; locked days, transfers and shifts past midnight are excluded. Existing saved plans do not change automatically.

Recommendation matching fills missing interests and pace from confirmed memories. AI edit previews receive anonymous aggregated interests, pace and budget categories; the server validates activity boundaries. Other members' profiles, reflections, evidence and reasons are not returned to the crew or included as raw profile objects in the edit prompt. The host's edits only produce evidence for the host.

This is an inspectable travel-preference model, not a psychological replica. There is no per-user fine-tuning, inferred sensitive identity, confidence percentage, automatic repeated-behavior model, or claim of measured recommendation uplift.

## Persistence and API

Apply `database/migrations/008_travel_memory_and_perks.sql` **after existing migrations and before starting the new backend**. Startup probes the new tables. Existing Docker volumes do not apply new init scripts on restart. PostgreSQL and Supabase both use the same transaction functions; tests exercise actual PostgreSQL and PostgREST through the respective application adapters.

Private tables: `travel_profiles`, `travel_edit_events`, `travel_memories`, `travel_imports`, `travel_wallets`, `travel_ledger`, `travel_ai_jobs`. RLS is enabled without browser policies. The backend database role must own/bypass the relevant RLS and have table/sequence privileges. The migration revokes public function execution and grants it to `service_role` when present; the migration owner can also execute. Do not expose these functions with browser credentials. Authentication remains the existing application session model.

| Endpoint | Purpose |
| --- | --- |
| `GET /api/me/travel-style` | Private profile, wallet, chapters and recent ledger |
| `PATCH /api/me/travel-style/settings` | Pause suggestions or future use |
| `POST /api/me/travel-style/remember` | Confirm a server-generated edit signal |
| `POST /api/me/travel-style/memories` | Explicit preference/correction |
| `DELETE /api/me/travel-style/memories[/:id]` | Reset or forget |
| `POST /api/me/travel-style/imports` | Parse pasted text into a durable draft |
| `GET/PATCH /api/me/travel-style/imports/:id` | Read/save an owned draft |
| `POST /api/me/travel-style/imports/:id/confirm` | Review, eligibility, optional memories and reward in one transaction |
| `DELETE /api/me/travel-style/imports/:id` | Remove private chapter and its memories |
| `POST /api/me/travel-style/redemptions` | Idempotent points exchange |
| `GET/POST /api/working-plans/:roomId/proposals` | Recover/create host-owned edit previews |
| `POST /api/working-plans/:roomId/changes` | Manual change, reviewed proposal, or undo |

Manual revisions, edit evidence, undo reversal and proposal application share one transaction. Proposal generation reserves a credit before the model call, persists its status/output, then captures or refunds. Valid commands are limited to eight add/remove/move/update operations and preserve locks. Applying requires the original saved revision and current preference fingerprint; stale requests need a new preview. A model never grants points or writes a plan directly. The existing shared per-account AI rate limit remains active.

## Pilot rewards and limitations

| Action | Current v1 policy |
| --- | --- |
| First private profile use | 3 welcome credits, once |
| Eligible reviewed completed-trip contribution | 100 points; first 3 rewarded contributions each calendar month |
| Redemption | 100 points → 5 credits |
| Valid persisted AI edit preview | 1 credit, even if dismissed |
| Fallback, failed or invalid preview | Credit refunded |
| Manual editing, ordinary chat, corrections and imports | Free |

Concurrent operations serialize on the wallet row. Request keys prevent duplicate generation/redemption charges. Reservations expire after 90 seconds and are refunded on the next private action/profile read; this is lazy recovery, not a scheduled worker. Late workers cannot capture expired reservations. Ledger sums reconcile with balances; holds and refunds are explicit entries.

Past-trip completion is self-reported. Dates must be real and in the past, users attest ownership/completion, and reviewed notes/reflections have minimum detail. Destination/date and normalized content hashes prevent repeat rewards after source deletion. Known copies of saved app plans are ineligible for points but can be saved. Hash receipts contain no raw trip text and survive source deletion; account deletion cascades them. These safeguards cannot establish proof of travel or catch every modified/fabricated submission. Perks have no cash value and amounts remain pilot choices.

Still outside v1: PDF/image extraction, per-activity completed/skipped structure, app-trip completion/review rewards, booking verification or live route feasibility, embeddings/activity retrieval, advanced ranking/diversity evaluation, automated confidence/decay, provider token-cost reporting, and a background reservation reconciler. The current 72-template catalogue is still the source of initial plans. All suggested timings, prices and availability remain unverified draft details.

## Verification

`npm run build`, frontend lint, backend unit tests, both provider suites, static route checks and the full browser journey are the verification commands. `backend/tests/travelMemory.integration.test.ts` covers authorization, opt-in learning, context and undo, reviewed drafts, duplicate/capped rewards, concurrent exchanges, fallback refunds, valid mocked-provider charges, retry recovery, expiry and stale preferences. `frontend/tools/check-personalization.mjs` covers the connected user journey with desktop/mobile screenshots at 1440, 390 and 320 pixels.

Local verification passed on 7 October 2026: production builds, 15 backend unit tests, 48 Node test records per database provider, 40 browser workflow checks, and both Vercel routing configurations. Lint reports only four pre-existing warnings in JoinQuestPage, QuestReadiness and QuestShortlist.

No production database, live AI provider or external email service is contacted by the isolated checks. Real provider behavior and deployed Vercel/Render integration require a separate deployment verification.
