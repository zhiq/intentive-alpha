# Intentive — Zero to Alpha: Task Plan

> Sequenced, dependency-aware task list optimized for **one-task-one-session**
> implementation. Each task names a model (haiku / sonnet / opus) and an effort
> level (low / medium / high / max). Phase 0 is foundational and is executed in
> the bootstrap session.

## How to read this

- **Model**: smallest model that can do the task well.
  - `haiku` — mechanical, well-specified, low ambiguity.
  - `sonnet` — standard feature work with clear spec.
  - `opus` — architecture, cross-cutting design, subtle correctness, AI prompts.
- **Effort**: budget for reasoning/iteration within the session.
- **Deps**: tasks that must land first.
- A task is sized to fit comfortably in a single focused session.

---

## Phase 0 — Foundation (this session)

The bedrock. Nothing else can be built without it. Done in the bootstrap
session because everything downstream imports from it.

| # | Task | Model | Effort | Deps |
|---|------|-------|--------|------|
| 0.1 | Scaffold Next.js (App Router) + TS strict + Tailwind + ESLint + Vitest config | sonnet | medium | — | DONE |
| 0.2 | Prisma schema for all 15 domain objects + enums; initial migration; `intentive` DB | opus | high | 0.1 | DONE |
| 0.3 | Domain enums + branded types + typed domain errors | opus | medium | 0.2 | DONE |
| 0.4 | Zod validation schemas (shared client/server) for intents, offers, policies, completion forms | opus | high | 0.3 | DONE |
| 0.5 | State-machine modules (Intent, LiveIntent, Offer, Booking) with transition guards + typed errors | opus | high | 0.3 | DONE |
| 0.6 | Observability: structured logger + event taxonomy hooks | sonnet | low | 0.1 | DONE |
| 0.7 | AI abstraction boundary: interface + Zod-validated outputs + deterministic mock provider + Claude provider stub | opus | max | 0.4 | DONE |
| 0.8 | Domain services skeleton wiring (Intent, MissingField, MarketActivation, Matching, OfferAutopilot, OfferRanking, Booking, Relationship, Reliability, MarketTrace) | opus | high | 0.4, 0.5, 0.7 | DONE |
| 0.9 | Seed script (users, 5 providers, services, availability, policies, passport, completed booking + relationship asset) | sonnet | medium | 0.2 | DONE |
| 0.10 | Unit tests for the domain core (parser mock, missing fields, transitions, matching, offer gen policy, ranking, booking accept, relationship) | opus | high | 0.5, 0.7, 0.8 | DONE |
| 0.11 | README + env + run/test instructions; `.env.example`; single-command run | sonnet | low | 0.1, 0.9 | DONE |

**Phase 0 exit criteria:** `npm install`, migrate, seed, run tests — all green;
app boots with mock AI; the domain core happy path is unit-tested.

---

## Phase 1 — Intent capture & completion (user side)

Turns raw text into a Market-Actionable Intent Object via the UI.

| # | Task | Model | Effort | Deps |
|---|------|-------|--------|------|
| 1.1 | Landing/Home: large intent box, examples, submit → parse | sonnet | medium | 0.7, 0.8 | DONE |
| 1.2 | Server action: `parseIntent` → persist DRAFT IntentObject + Intent Card data | sonnet | medium | 0.7, 0.8 | DONE |
| 1.3 | Intent Creation page: Intent Card render (editable), Missing Details detection display | opus | high | 1.2 | INCOMPLETE — `createIntentAction` redirects to `/intents/[id]` but that route does not exist. Need: `src/app/intents/[id]/page.tsx` rendering the IntentObject as an editable Intent Card, with `MissingFieldService` output displayed. |
| 1.4 | Structured completion form (mandatory blockers) + "Improve your offers" optional fields | sonnet | high | 1.3, 0.4 | INCOMPLETE — `applyCompletionAction` server action exists but there is no UI form to invoke it. Need: completion form component inside the `/intents/[id]` page with mandatory-field inputs and an optional "Improve your offers" section wired to `applyCompletionAction`. |
| 1.5 | Preference Passport apply-on-create (non-conflicting defaults, shown editable) | sonnet | medium | 0.8, 1.3 | INCOMPLETE — `IntentParsingService` reads the passport and builds `UserContext`, so defaults are applied server-side. However there is no UI in the (not-yet-built) intent creation page that surfaces the passport-derived pre-fills as editable fields. Need: editable passport-default fields displayed inside the Intent Card on `/intents/[id]`. |
| 1.6 | Mark Market-Actionable transition wired to UI | haiku | low | 0.5, 1.4 | INCOMPLETE — `applyCompletionAction` transitions intent to `MARKET_ACTIONABLE` when all mandatory fields resolve, and `activateIntentAction` exists. But neither the `/intents/[id]` page nor any UI CTA triggers these actions. Need: "Activate" button in `/intents/[id]` visible when status is `MARKET_ACTIONABLE`, calling `activateIntentAction`. |

## Phase 2 — Activation, matching & autopilot

| # | Task | Model | Effort | Deps |
|---|------|-------|--------|------|
| 2.1 | MarketActivationService: DRAFT/ACTIONABLE → LIVE, create LiveIntent, trace | sonnet | medium | 0.8, 1.6 | DONE |
| 2.2 | ProviderMatchingService: eligibility filter + match scoring + top 3–5 cap | opus | high | 0.8, 0.9 | DONE |
| 2.3 | Low-liquidity / serviceability warning (<2 eligible) pre- and during-live | sonnet | medium | 2.2 | INCOMPLETE — `LOW_LIQUIDITY_WARNING` event is emitted in `MarketActivationService` when fewer than 2 eligible providers are found, but there is no UI surface to display it. Need: warning banner in the (not-yet-built) Live Intent Status page and/or intent card when liquidity < 2, reading the trace or a service return value. |
| 2.4 | OfferAutopilotService: generate Suggested Offer respecting policy (min price, add-on-over-discount, deposit, cancellation) | opus | high | 0.7, 2.2 | DONE |
| 2.5 | OfferBrief generation (Reasoned Offer Brief) | sonnet | medium | 0.7, 2.4 | DONE |
| 2.6 | Live Intent Status page (status, invited, received, expiry countdown, improve suggestions, cancel) | sonnet | high | 2.1, 2.2 | INCOMPLETE — `activateIntentAction` redirects to `/intents/[id]/live` but that route does not exist. Need: `src/app/intents/[id]/live/page.tsx` showing `LiveIntent` status, invited/received provider counts, expiry countdown, improvement suggestions from `MissingFieldService`, and a cancel action. |

## Phase 3 — Provider experience

| # | Task | Model | Effort | Deps |
|---|------|-------|--------|------|
| 3.1 | Provider Dashboard: invited Live Intents + suggested offers awaiting approval | sonnet | high | 2.4 | INCOMPLETE — header nav links to `/provider` but the route does not exist. Need: `src/app/provider/page.tsx` listing the signed-in provider's incoming `LiveIntent` invitations and `SUGGESTED`/`APPROVED` offers awaiting action. |
| 3.2 | Approve / Edit / Decline offer actions + state transitions + authz | opus | high | 0.5, 3.1 | INCOMPLETE — `OfferService` implements approve/edit/decline transitions and `state/offer.ts` guards them. But no server actions expose these to the UI, and `requireRole(UserRole.PROVIDER)` is not enforced on any offer action. Need: provider-only server actions for approve/edit/decline wired with `requireRole(PROVIDER)` + UI action buttons in the Provider Dashboard. |
| 3.3 | Provider Offer Policy settings page (services, prices, discount, add-ons, deposit, cancellation, fulfillment, radius, toggles) | sonnet | high | 0.4 | INCOMPLETE — `ProviderOfferPolicy` model is in the schema and seeded, but no `/provider/settings` (or equivalent) page exists. Need: policy settings page with a form covering all `ProviderOfferPolicy` columns and a save server action. |
| 3.4 | Offer send → user inbox + OFFER_READY transition + traces | sonnet | medium | 3.2 | INCOMPLETE — `OfferService` and state machine cover `APPROVED/EDITED → SENT`, and `OFFER_SENT` trace event is defined. But no "send offer" server action exists, and the `IntentObject` `OFFER_READY` transition is not triggered anywhere in the UI flow. Need: send-offer server action calling `OfferService.send()` + `IntentObject → OFFER_READY` transition after first offer is sent. |

## Phase 4 — Offer Inbox, acceptance & booking

| # | Task | Model | Effort | Deps |
|---|------|-------|--------|------|
| 4.1 | OfferRankingService: fit/value/convenience/risk + Recommended/Best Value/Fastest labels | opus | high | 0.7, 3.4 | DONE |
| 4.2 | Offer Inbox UI: structured cards, highlights ≤3, reasoned brief, scores | sonnet | high | 4.1 | INCOMPLETE — header nav links to `/inbox` but the route does not exist. Need: `src/app/inbox/page.tsx` calling `OfferRankingService.rankOffers()` and rendering structured offer cards with Recommended/Best Value/Fastest labels, reasoned brief, and score breakdown. |
| 4.3 | Accept offer (transaction): accept, reject/expire others, create Booking, book availability, transitions, traces, race-safety | opus | max | 0.5, 0.8, 4.2 | DONE |
| 4.4 | Bookings page (user + provider), statuses | sonnet | medium | 4.3 | INCOMPLETE — no `/bookings` page exists. Need: `src/app/bookings/page.tsx` showing booking cards for users (their accepted bookings) and providers (their confirmed bookings), with `BookingStatus` labels and key details. |

## Phase 5 — Completion, relationships & reliability

| # | Task | Model | Effort | Deps |
|---|------|-------|--------|------|
| 5.1 | Mark-completed action (provider/admin) | sonnet | low | 4.4 | INCOMPLETE — no mark-completed server action or UI exists; `BookingService` has no `complete()` method. Need: server action `completeBookingAction(bookingId)` guarded by `requireRole(PROVIDER, ADMIN)` that transitions `BookingStatus → COMPLETED` and triggers `RelationshipService` + `ReliabilityService` updates. |
| 5.2 | RelationshipService: create/update Relationship Asset on completion | sonnet | medium | 5.1 | DONE |
| 5.3 | ReliabilityService: update user + provider signals + transparent display | sonnet | medium | 5.1 | INCOMPLETE — `ReliabilityService.recordSignal()` stores `ReliabilitySignal` rows and updates provider/user scores. The "transparent display" half is absent — no UI component surfaces score breakdowns. Need: reliability score display component shown on provider cards in the Offer Inbox and on booking/provider detail pages. |
| 5.4 | Relationship-aware rebooking: "same as last time" prefill from history + passport | opus | high | 5.2, 1.2 | INCOMPLETE — `RelationshipAsset` is stored and `IntentParsingService` reads relationship history for `UserContext`. But there is no rebooking UI entry point that pre-populates intent fields from `RelationshipAsset` + `PreferencePassport`. Need: "Book again" CTA on the Bookings page that calls `createIntentAction` with history pre-filled, and a UI indication of which fields came from history. |
| 5.5 | Reliability Rewards transparent copy + display surfaces | haiku | low | 5.3 | INCOMPLETE — no Reliability Rewards copy or display component exists anywhere. Need: explanatory copy on what reliability scores mean and how they affect outcomes, shown to users and providers at relevant touchpoints (e.g., offer cards, provider profile, booking confirmation). |

## Phase 6 — Admin, auth, hardening & E2E

| # | Task | Model | Effort | Deps |
|---|------|-------|--------|------|
| 6.1 | Local alpha auth (role switch: user/provider/admin) + server authz guards everywhere | opus | high | 0.8 | INCOMPLETE — `lib/auth.ts` implements `getSession()` (cookie impersonation + USER fallback), `requireSession()`, and `requireRole()`. `requireSession()` is called in all three server actions. However `requireRole()` is not called anywhere — provider-only and admin-only operations are unguarded. The role-switch UI (to impersonate roles) also does not exist. Need: `requireRole(PROVIDER)` / `requireRole(ADMIN)` guards on all non-user actions + a dev-mode role-switch control (e.g., header dropdown). |
| 6.2 | Admin / Debug page (intents, live intents, offers, traces, AI validation status, mock/Claude mode) | sonnet | medium | 6.1 | INCOMPLETE — header nav links to `/admin` but the route does not exist. Need: `src/app/admin/page.tsx` listing all `IntentObject`, `LiveIntent`, `OfferObject`, `MarketOutcomeTrace` records, current AI provider mode, and a toggle for mock/Claude. |
| 6.3 | Preference Passport page (editable) | sonnet | medium | 1.5 | INCOMPLETE — header nav links to `/passport` but the route does not exist. Need: `src/app/passport/page.tsx` rendering the current user's `PreferencePassport` fields in an editable form with a save server action. |
| 6.4 | Rate-limiting hooks / TODO-ready middleware | haiku | low | 6.1 | INCOMPLETE — `lib/rateLimit.ts` has a fully functional in-memory fixed-window limiter (`checkRateLimit`, `RateLimitOptions`, `RateLimitResult`). But `checkRateLimit()` is not called in any server action, and no `middleware.ts` exists. Need: `checkRateLimit()` calls at the top of `createIntentAction`, `activateIntentAction`, and the offer-accept action; and a stub `middleware.ts` with a TODO comment for IP-level limiting. |
| 6.5 | Playwright happy-path E2E | opus | high | 4.3, 5.1 | INCOMPLETE — Playwright is in `package.json` dependencies but no `tests/e2e/` directory or test files exist. Need: Playwright E2E test file covering the happy path: home → submit intent → completion form → activate → live status → offer inbox → accept offer → booking confirmed. |
| 6.6 | Polish: empty/loading/error states, responsive/mobile pass, a11y | sonnet | high | all UI | INCOMPLETE — only the home page and `IntentBox` exist; no other pages have been built yet. Need (once UI pages exist): loading skeletons, empty-state messages, error boundaries on all pages; responsive layout pass for mobile breakpoints; a11y audit covering semantic HTML, focus management, and screen-reader labels. |

---

## Critical path

`0.1 → 0.2 → 0.3 → 0.4 → 0.7 → 0.8 → (1.x) → 2.1 → 2.2 → 2.4 → 3.2 → 3.4 → 4.1 → 4.3 → 5.1`

State machine (0.5), validation (0.4), and AI boundary (0.7) are the highest-
leverage foundations — they are built with `opus` at high/max effort because a
defect there propagates everywhere.

## Sequencing rationale

- **Foundation before features.** Schema, types, validation, state machines, and
  the AI boundary are shared by every feature; building them first prevents
  rework and lets later sessions stay small and mechanical.
- **User intent path before provider path before inbox.** Mirrors the product
  loop; each phase produces something demoable.
- **Transactions and race-safety isolated** (4.3) at max effort because booking
  acceptance is the one place correctness failures cost money.
- **Auth/hardening late but not last** — guards are stubbed from 0.8 and made
  real in 6.1 so feature sessions don't fight auth plumbing prematurely.
