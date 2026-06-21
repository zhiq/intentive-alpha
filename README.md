# Intentive (alpha)

**AI-native intent-to-capacity market-making platform.** You type a messy,
natural-language request; Intentive turns it into a structured, market-actionable
**Intent Object**, activates the right supply, and brings back a few **reasoned
offers** you can choose from with confidence.

This is **not** a booking app, a provider directory, a package browser, or a
chatbot wrapper. The unit of work is *intent*, never *search*.

> **Mantra:** Messy human intent becomes a market-actionable object. The platform
> activates the right supply. Providers approve AI-suggested offers. Users receive
> a few reasoned choices. Every transaction strengthens trust, preference memory,
> and future market quality.

Alpha vertical: **same-day massage / wellness** (KL / PJ).

See [`docs/canonical/product-vision.md`](docs/canonical/product-vision.md) for the
vision and principles, and [`docs/zero-to-alpha.md`](docs/zero-to-alpha.md) for the
phased task plan.

## The product loop

```
Messy intent in
  → structured request out (Intent Object → Intent Card)
  → live market activated (Live Intent → matched supply, top 3–5 only)
  → reasoned offers received (Provider Offer Autopilot → Offer Inbox)
  → user chooses confidently (Accept → Booking)
  → relationship + reliability strengthened
```

## Architecture

Clean separation of concerns:

| Layer | Location | Responsibility |
|-------|----------|----------------|
| Domain enums / types / errors | `src/domain` | Vocabulary, value types, typed errors |
| State machines | `src/domain/state` | Safe, guarded status transitions |
| Validation schemas (Zod) | `src/domain/schema` | Shared client/server validation |
| AI abstraction | `src/ai` | `AiProvider` interface, deterministic **mock**, **Claude** provider, validated outputs |
| Application services | `src/services` | Business logic, orchestration, transactions |
| Persistence | `prisma/`, `src/lib/prisma.ts` | PostgreSQL via Prisma |
| Observability | `src/observability` | Structured logger + event taxonomy |
| UI | `src/app`, `src/components` | Next.js App Router, Tailwind |

**Key invariants**

- **AI never mutates the database.** Every AI method returns structured JSON that
  is validated with Zod before any persistence.
- **Business rules are deterministic.** Eligibility, matching, pricing guardrails,
  and missing-field detection are rule-based and unit-tested. AI handles only
  language understanding and drafting.
- **All status changes go through a state machine.** Invalid transitions throw a
  typed `InvalidTransitionError`.
- **Offer acceptance is a single transaction** with race-safe slot reservation —
  no double-booking, no partial writes.
- **Provider policy clamps every offer.** Even a misbehaving model cannot produce
  an out-of-policy offer.

## Core domain objects

`User`, `PreferencePassport`, `Provider`, `ProviderService`,
`ProviderAvailability`, `ProviderOfferPolicy`, `IntentObject`, `LiveIntent`,
`OfferObject`, `Booking`, `RelationshipAsset`, `ReliabilitySignal`,
`MarketOutcomeTrace`. (`IntentField` is modeled as the validated completion-form
schema rather than a table.) See `prisma/schema.prisma`.

## Domain services

`IntentParsingService`, `IntentService`, `MissingFieldService`,
`MarketActivationService`, `ProviderMatchingService`, `OfferAutopilotService`,
`OfferService`, `OfferRankingService`, `BookingService`, `RelationshipService`,
`ReliabilityService`, `MarketTraceService`.

## Setup

### Prerequisites

- Node.js 20+ (tested on 22)
- PostgreSQL 14+ running locally

### 1. Install

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `DATABASE_URL` if your Postgres differs from the default
(`postgresql://postgres:postgres@localhost:5432/intentive`).

### 3. Migrate + seed (single command)

```bash
npm run setup
```

This runs `prisma generate`, applies migrations, and seeds demo data. To do it
step by step:

```bash
npm run prisma:migrate   # create/apply migrations
npm run db:seed          # seed users, 5 providers, services, availability, etc.
```

Reset everything:

```bash
npm run db:reset         # drops, re-migrates, and re-seeds
```

### 4. Run

```bash
npm run dev              # http://localhost:3000
```

## Environment variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `DATABASE_URL` | Postgres connection | local intentive db |
| `ANTHROPIC_API_KEY` / `CLAUDE_API_KEY` | Enables the Claude AI provider | *(unset → mock)* |
| `AI_PROVIDER` | Force `mock` or `claude` | auto |
| `AI_MODEL` | Claude model when active | `claude-sonnet-4-6` |

## Switching between mock AI and Claude AI

- **No key present → deterministic mock AI** (the alpha default). Same inputs
  always produce the same outputs, so the whole market is testable offline.
- **Set `ANTHROPIC_API_KEY` (or `CLAUDE_API_KEY`) → Claude AI** is used
  automatically. If a Claude call fails or returns invalid JSON, the app
  **falls back to the mock provider** and logs `system.ai_fallback_used`, so it
  never hard-fails on the AI boundary.
- Force a provider explicitly with `AI_PROVIDER=mock` or `AI_PROVIDER=claude`.

The app runs fully with mock AI and **no keys required**.

## Tests

```bash
npm test            # unit + integration (Vitest)
npm run test:watch  # watch mode
npm run typecheck   # strict TypeScript, no emit
npm run lint        # ESLint (strict, no `any`)
npm run test:e2e    # Playwright happy-path (see alpha limitations)
```

Unit/integration coverage includes: intent parsing (mock), missing-field
detection, state transitions, provider matching, policy-respecting offer
generation, offer ranking, booking acceptance, and relationship-asset creation.
The integration test (`tests/unit/marketFlow.test.ts`) exercises the full loop
against a local Postgres.

## Demo accounts (seeded)

| Role | Email |
|------|-------|
| User | `user@intentive.test` |
| Provider owner | `provider@intentive.test` (owns all 5 providers) |
| Admin | `admin@intentive.test` |

Local alpha auth impersonates the seeded user via a cookie (no real auth yet).

## Alpha limitations

- **Auth is impersonation, not authentication.** `src/lib/auth.ts` is a single
  swap-point for Auth.js later; server-side authorization checks are already wired
  through every service.
- **Geocoding is a small static gazetteer** of KL/PJ areas (`src/lib/geo.ts`);
  `"near me"` without device coordinates falls back to the city center with lower
  distance confidence.
- **UI coverage is being built out by phase** (see `docs/zero-to-alpha.md`). Phase
  0 ships the foundation, the domain core, the landing/intent capture entry point,
  and the full tested service layer. Later phases add the remaining screens
  (Intent Creation, Live Status, Offer Inbox, Provider Dashboard, Policy Settings,
  Bookings, Passport, Admin).
- **No real payments**; deposits/prices are modeled but not charged.
- **Rate limiting** is a documented hook, not yet enforced.
- **Pricing/rewards are transparent by design** — no opaque or proxy-based
  personalized pricing.

## License

Proprietary alpha — internal evaluation only.
