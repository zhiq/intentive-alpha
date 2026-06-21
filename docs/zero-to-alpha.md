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
| 0.1 | Scaffold Next.js (App Router) + TS strict + Tailwind + ESLint + Vitest config | sonnet | medium | — |
| 0.2 | Prisma schema for all 15 domain objects + enums; initial migration; `intentive` DB | opus | high | 0.1 |
| 0.3 | Domain enums + branded types + typed domain errors | opus | medium | 0.2 |
| 0.4 | Zod validation schemas (shared client/server) for intents, offers, policies, completion forms | opus | high | 0.3 |
| 0.5 | State-machine modules (Intent, LiveIntent, Offer, Booking) with transition guards + typed errors | opus | high | 0.3 |
| 0.6 | Observability: structured logger + event taxonomy hooks | sonnet | low | 0.1 |
| 0.7 | AI abstraction boundary: interface + Zod-validated outputs + deterministic mock provider + Claude provider stub | opus | max | 0.4 |
| 0.8 | Domain services skeleton wiring (Intent, MissingField, MarketActivation, Matching, OfferAutopilot, OfferRanking, Booking, Relationship, Reliability, MarketTrace) | opus | high | 0.4, 0.5, 0.7 |
| 0.9 | Seed script (users, 5 providers, services, availability, policies, passport, completed booking + relationship asset) | sonnet | medium | 0.2 |
| 0.10 | Unit tests for the domain core (parser mock, missing fields, transitions, matching, offer gen policy, ranking, booking accept, relationship) | opus | high | 0.5, 0.7, 0.8 |
| 0.11 | README + env + run/test instructions; `.env.example`; single-command run | sonnet | low | 0.1, 0.9 |

**Phase 0 exit criteria:** `npm install`, migrate, seed, run tests — all green;
app boots with mock AI; the domain core happy path is unit-tested.

---

## Phase 1 — Intent capture & completion (user side)

Turns raw text into a Market-Actionable Intent Object via the UI.

| # | Task | Model | Effort | Deps |
|---|------|-------|--------|------|
| 1.1 | Landing/Home: large intent box, examples, submit → parse | sonnet | medium | 0.7, 0.8 |
| 1.2 | Server action: `parseIntent` → persist DRAFT IntentObject + Intent Card data | sonnet | medium | 0.7, 0.8 |
| 1.3 | Intent Creation page: Intent Card render (editable), Missing Details detection display | opus | high | 1.2 |
| 1.4 | Structured completion form (mandatory blockers) + "Improve your offers" optional fields | sonnet | high | 1.3, 0.4 |
| 1.5 | Preference Passport apply-on-create (non-conflicting defaults, shown editable) | sonnet | medium | 0.8, 1.3 |
| 1.6 | Mark Market-Actionable transition wired to UI | haiku | low | 0.5, 1.4 |

## Phase 2 — Activation, matching & autopilot

| # | Task | Model | Effort | Deps |
|---|------|-------|--------|------|
| 2.1 | MarketActivationService: DRAFT/ACTIONABLE → LIVE, create LiveIntent, trace | sonnet | medium | 0.8, 1.6 |
| 2.2 | ProviderMatchingService: eligibility filter + match scoring + top 3–5 cap | opus | high | 0.8, 0.9 |
| 2.3 | Low-liquidity / serviceability warning (<2 eligible) pre- and during-live | sonnet | medium | 2.2 |
| 2.4 | OfferAutopilotService: generate Suggested Offer respecting policy (min price, add-on-over-discount, deposit, cancellation) | opus | high | 0.7, 2.2 |
| 2.5 | OfferBrief generation (Reasoned Offer Brief) | sonnet | medium | 0.7, 2.4 |
| 2.6 | Live Intent Status page (status, invited, received, expiry countdown, improve suggestions, cancel) | sonnet | high | 2.1, 2.2 |

## Phase 3 — Provider experience

| # | Task | Model | Effort | Deps |
|---|------|-------|--------|------|
| 3.1 | Provider Dashboard: invited Live Intents + suggested offers awaiting approval | sonnet | high | 2.4 |
| 3.2 | Approve / Edit / Decline offer actions + state transitions + authz | opus | high | 0.5, 3.1 |
| 3.3 | Provider Offer Policy settings page (services, prices, discount, add-ons, deposit, cancellation, fulfillment, radius, toggles) | sonnet | high | 0.4 |
| 3.4 | Offer send → user inbox + OFFER_READY transition + traces | sonnet | medium | 3.2 |

## Phase 4 — Offer Inbox, acceptance & booking

| # | Task | Model | Effort | Deps |
|---|------|-------|--------|------|
| 4.1 | OfferRankingService: fit/value/convenience/risk + Recommended/Best Value/Fastest labels | opus | high | 0.7, 3.4 |
| 4.2 | Offer Inbox UI: structured cards, highlights ≤3, reasoned brief, scores | sonnet | high | 4.1 |
| 4.3 | Accept offer (transaction): accept, reject/expire others, create Booking, book availability, transitions, traces, race-safety | opus | max | 0.5, 0.8, 4.2 |
| 4.4 | Bookings page (user + provider), statuses | sonnet | medium | 4.3 |

## Phase 5 — Completion, relationships & reliability

| # | Task | Model | Effort | Deps |
|---|------|-------|--------|------|
| 5.1 | Mark-completed action (provider/admin) | sonnet | low | 4.4 |
| 5.2 | RelationshipService: create/update Relationship Asset on completion | sonnet | medium | 5.1 |
| 5.3 | ReliabilityService: update user + provider signals + transparent display | sonnet | medium | 5.1 |
| 5.4 | Relationship-aware rebooking: "same as last time" prefill from history + passport | opus | high | 5.2, 1.2 |
| 5.5 | Reliability Rewards transparent copy + display surfaces | haiku | low | 5.3 |

## Phase 6 — Admin, auth, hardening & E2E

| # | Task | Model | Effort | Deps |
|---|------|-------|--------|------|
| 6.1 | Local alpha auth (role switch: user/provider/admin) + server authz guards everywhere | opus | high | 0.8 |
| 6.2 | Admin / Debug page (intents, live intents, offers, traces, AI validation status, mock/Claude mode) | sonnet | medium | 6.1 |
| 6.3 | Preference Passport page (editable) | sonnet | medium | 1.5 |
| 6.4 | Rate-limiting hooks / TODO-ready middleware | haiku | low | 6.1 |
| 6.5 | Playwright happy-path E2E | opus | high | 4.3, 5.1 |
| 6.6 | Polish: empty/loading/error states, responsive/mobile pass, a11y | sonnet | high | all UI |

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
