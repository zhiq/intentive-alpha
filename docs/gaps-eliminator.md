# Intentive Gaps Eliminator — Bedrock-Grade Action Plan

> Objective: elevate Intentive from a strong alpha foundation into a world-class AI-centric intent-to-capacity market-making product in its solution class.
>
> Method: code-informed multidimensional review of product vision, UI, AI boundary, domain services, persistence, state machines, and existing implementation plan.
>
> Scope reviewed: `docs/canonical/product-vision.md`, `docs/zero-to-alpha.md`, `README.md`, `src/app`, `src/components`, `src/ai`, `src/services`, `src/domain`, and `prisma/schema.prisma`.

## 1. Executive synthesis

Intentive has a notably strong bedrock for an alpha: explicit product principles, a typed domain model, deterministic state machines, Zod-validated AI outputs, mock/Claude AI separation, and service-layer orchestration. The most important gap is not lack of ambition; it is that the implementation currently behaves like a robust backend prototype with a thin entry UI, while the product vision requires an end-to-end trust-building market experience.

The highest-impact improvement path is therefore:

1. **Close broken user journeys first.** Several server actions redirect to routes that do not exist, so users cannot inspect the Intent Card, complete blockers, activate a Live Intent, see offers, or accept bookings through the UI.
2. **Turn AI from hidden parser into visible decision partner.** The app stores confidence and ambiguity notes, but the UI does not expose what was inferred, what is uncertain, or why an action is blocked.
3. **Harden market correctness.** Matching, activation, policy clamping, and booking are promising, but several subtle logic issues can create inaccurate availability, misleading low-liquidity states, or policy inconsistencies.
4. **Build provider approval and trust loops.** The canonical loop depends on providers approving Suggested Offers and completed transactions strengthening Relationship Assets and Reliability Signals; the services exist, but user/provider surfaces are missing.
5. **Add production posture around auth, rate limits, observability dashboards, expiry jobs, privacy, and E2E tests.** These are necessary for Bedrock-grade confidence, even in alpha.

## 2. Multidimensional expert analysis

### 2.1 Product-loop completeness

**Current strength**

- The canonical loop is clearly represented in services: parse intent, detect missing fields, activate market, match providers, draft offers, approve/send offers, rank offers, accept booking, record relationships, and update reliability.
- `docs/zero-to-alpha.md` already identifies many route-level incompletions.

**Gaps**

- Home submission redirects to `/intents/[id]`, but the Intent Card route is not implemented.
- Activation redirects to `/intents/[id]/live`, but the Live Intent Status page is not implemented.
- Header/documentation references provider, inbox, bookings, passport, and admin surfaces, but these routes are not implemented.
- The end-to-end product promise cannot be experienced without writing scripts or invoking services directly.

**Impact**

- The app cannot demonstrate its primary differentiator: turning messy intent into a visible, editable, market-actionable object and then into reasoned choices.

### 2.2 AI functionality and AI-centric UX

**Current strength**

- AI is correctly bounded: providers return structured JSON, Zod validation protects writes, and deterministic mock AI keeps the product testable offline.
- The parser includes confidence fields and ambiguity notes.
- Missing-field detection is deterministic, which is correct for business gating.

**Gaps**

- The UI does not show the parsed Intent Object, field-level confidence, ambiguity notes, or source of inferred defaults.
- Passport and relationship defaults can be applied silently in the parser context, but the user has no editable visibility into which fields came from memory.
- AI-generated Reasoned Offer Briefs exist in offer objects, but there is no Offer Inbox to display or compare them.
- The AI provider prompt does not enforce a strict refusal/unsupported-category pattern for requests outside the alpha vertical; out-of-vertical requests may become malformed or weak massage intents instead of clear unsupported states.
- There is no confidence-aware activation gate. A required field can be present but semantically weak, such as ambiguous `near me` without coordinates or generic preferences that look complete enough to activate.
- `generateUserFriendlyClarification` exists but is not integrated into Missing Details UX.

**Impact**

- The product feels less AI-native than its architecture. Users are asked to trust a black box rather than inspect and correct AI understanding.

### 2.3 User experience design deficiencies

**Current strength**

- The landing page matches the vision: natural-language intent capture, no browse/search framing, and concise explanation.

**Gaps**

- The primary CTA says “Create live request,” but the action only creates an Intent Object and redirects to completion; this can overpromise activation.
- No progressive disclosure exists between mandatory blockers and optional “Improve your offers” fields.
- No low-liquidity guidance is surfaced to users before or after activation.
- No empty, loading, expired, cancelled, or offer-waiting states exist for the core flows.
- No provider-side workflow exists for approving, editing, or declining Suggested Offers.
- No mobile/a11y pass beyond the basic home form.

**Impact**

- Users may feel that the system is either magic or broken. Providers have no way to participate in the human-in-the-loop offer approval model.

### 2.4 Domain and business logic correctness

**Current strength**

- State machines, typed domain errors, and transaction boundaries are excellent architectural decisions.
- Booking acceptance uses guarded slot reservation in a transaction.

**Gaps and inaccuracies**

1. **Availability window matching is too strict and potentially incorrect.** Provider matching requires a provider slot to start before `requestedStart - flex` and end after `requestedStart + duration + flex`. A provider available at the exact requested time may be excluded when flexibility is nonzero because the slot must cover the entire expanded window, not just at least one feasible appointment within that window.
2. **Provider policy radius is modeled but ignored.** `ProviderOfferPolicy.maxTravelRadiusKm` exists, but matching only uses `Provider.serviceRadiusKm` and user travel radius.
3. **Location confidence is not operationalized.** `near me` can produce a location text without latitude/longitude; `resolveIntentPoint` may fall back to a generic point, creating misleading matching and distance scores.
4. **Offer price clamping may unintentionally cap at standard price.** `clampToPolicy` forces prices into `[minPrice, standardPrice]`, but provider services also model `maxPrice`. This blocks legitimate premium pricing or add-on-inclusive pricing unless intentionally prohibited.
5. **Policy add-on allowlist is not enforced by identity.** The code slices AI add-ons to five when add-ons are allowed, but it does not ensure the selected add-ons are in `allowedAddOns`.
6. **Activation can create a Live Intent with zero providers.** Honest liquidity is logged, but the UX/service does not present an actionable pre-activation choice to widen radius/time/mode.
7. **Expiry exists as timestamps but no sweeper.** Intent, LiveIntent, and Offer statuses can become stale unless manually transitioned.
8. **Relationship completion has a first-booking count ambiguity.** New Relationship Assets are created with `rebookingCount: 0`, while updates increment. If the field means completed bookings, the first completion should be counted. If it means repeat bookings, the name is misleading.
9. **Offer approval state machine is compressed in implementation.** `approveAndSend` checks `SUGGESTED -> APPROVED -> SENT` but persists only `SENT`, which may be acceptable, but it removes an auditable persisted approval state.
10. **Role authorization is incomplete.** Services check ownership in places, but provider/admin role guards and route-level access are not broadly wired.

**Impact**

- These gaps can cause real market failures: no offers despite available supply, inaccurate distance/radius matching, stale offers, incorrect pricing constraints, or insufficient provider/user trust.

### 2.5 Trust, safety, privacy, and fairness

**Current strength**

- The product vision explicitly rejects opaque personalized pricing and sensitive/proxy attribute pricing.
- Reliability Signals are named, explainable events.

**Gaps**

- No UI explains reliability scoring, signals, or rewards.
- No privacy surface explains how Preference Passport, relationship memory, and raw intents are stored or edited.
- No data minimization path exists for deleting/clearing memory.
- No audit UI exists for AI fallback, validation failures, offer edits, or market traces.
- No prompt-injection or unsafe-content test cases exist around raw user intent.

**Impact**

- Trust is a canonical compounding asset, but users and providers cannot yet see, correct, or contest trust-affecting data.

### 2.6 Observability, testability, and operations

**Current strength**

- Market event taxonomy and trace service are present.
- Unit/integration tests cover several domain core paths.

**Gaps**

- No admin/debug dashboard surfaces traces, AI mode, validation status, or funnel bottlenecks.
- No E2E happy-path test exists for the browser journey.
- Rate limiting is implemented as a hook but not enforced.
- No scheduled/background process handles expiry, stale live intents, or stale suggested offers.
- No metrics around parse confidence, missing-field drop-off, provider approval latency, offer acceptance rate, liquidity, or AI fallback rate.

**Impact**

- The team cannot reliably diagnose where market-making fails or prove that AI boundaries remain safe under real usage.

## 3. High-impact insight stack

1. **The Intent Card is the keystone UI.** Until users can inspect/edit AI understanding, every downstream AI feature feels opaque.
2. **Liquidity should be a guided negotiation, not a logged warning.** Low supply should trigger widening suggestions before wasting provider/user attention.
3. **Provider approval is the marketplace trust hinge.** Without a provider dashboard, the product collapses into generated offers without human confirmation.
4. **Matching correctness is product quality.** Small time/radius bugs become “no providers found,” the most damaging marketplace failure state.
5. **Reliability and relationship memory must be visible and editable.** Hidden memory erodes trust, even if technically useful.
6. **Bedrock-grade means route completeness plus operational invariants.** Typed backend architecture is necessary but not sufficient; E2E flows, auth, rate limits, expiry, and observability close the gap.

## 4. One-task-one-session action plan

Each task is sized to be completed independently in one focused session. Sequence is optimized for unlocking the canonical loop first, then eliminating correctness and trust gaps.

### Phase A — Restore the broken user loop

| # | Task | Outcome | Primary files/modules | Dependencies |
|---|------|---------|-----------------------|--------------|
| A1 | Build `/intents/[id]` Intent Card page | User sees parsed Intent Object, missing mandatory blockers, confidence notes, and editable fields. | `src/app/intents/[id]/page.tsx`, new Intent Card component | none |
| A2 | Wire completion form with mandatory vs optional sections | Users can resolve blockers without being over-asked; optional fields sit under “Improve your offers.” | Intent Card component, `applyCompletionAction` | A1 |
| A3 | Add source labels for inferred defaults | Fields show “from your text,” “from Passport,” “from relationship,” or “low confidence.” | parser confidence display, Intent Card UI | A1 |
| A4 | Fix CTA language and state-aware actions | Home CTA becomes “Create Intent Card”; Activate CTA appears only when market-actionable. | `IntentBox`, `/intents/[id]` | A1-A2 |
| A5 | Build `/intents/[id]/live` Live Intent Status page | Users see provider invites, offers received, expiry, waiting states, and cancel action. | live route, `MarketActivationService` reads | A4 |
| A6 | Build `/inbox` Offer Inbox | Users see at most three reasoned offer cards with highlights, score breakdowns, and accept CTA. | `OfferRankingService`, `BookingService`, inbox route | A5, provider send path or seeded sent offers |
| A7 | Build `/bookings` user booking page | Accepted bookings become visible with confirmation details and statuses. | `BookingService.listForUser`, bookings route | A6 |

### Phase B — Provider human-in-the-loop completion

| # | Task | Outcome | Primary files/modules | Dependencies |
|---|------|---------|-----------------------|--------------|
| B1 | Build provider dashboard | Provider owners see Suggested Offers awaiting approval/edit/decline. | `src/app/provider/page.tsx`, `OfferService.listAwaitingApproval` | A5 |
| B2 | Add provider-only offer actions | Approve/send, edit/send, and decline are exposed via guarded server actions. | new provider actions, `OfferService`, `requireRole(PROVIDER)` | B1 |
| B3 | Add provider policy settings page | Providers can edit pricing, add-ons, deposits, cancellation, auto-suggest/send, radius. | provider settings route, policy schema/action | B2 |
| B4 | Persist approval audit state deliberately | Either persist `APPROVED` before `SENT` or document/send as atomic approval with trace clarity. | `OfferService.approveAndSend`, offer state tests | B2 |

### Phase C — Market correctness and liquidity intelligence

| # | Task | Outcome | Primary files/modules | Dependencies |
|---|------|---------|-----------------------|--------------|
| C1 | Correct availability-window matching | Providers are eligible if any feasible appointment start exists inside the user's flexible window. | `ProviderMatchingService`, tests | none |
| C2 | Enforce policy travel radius | Matching respects both provider-level service radius and policy-level max travel radius. | `ProviderMatchingService`, tests | C1 |
| C3 | Make `near me` coordinate-aware | `near me` without actual coordinates remains a blocker or low-confidence editable field, not generic matching. | `missingFields`, `geo`, completion UI | A1 |
| C4 | Add low-liquidity preflight UX | Before activation, users see eligible count and specific widening suggestions. | `previewLiquidity`, Intent Card UI | A4, C1-C3 |
| C5 | Add no-supply recovery loop | Live page suggests widening time, radius, budget, or fulfillment mode and re-running matching. | live page, activation service | A5, C4 |
| C6 | Add expiry sweeper | Expired Intent, LiveIntent, and Offer records transition to expired statuses consistently. | new scheduled script/service, state tests | A5 |
| C7 | Fix offer policy clamping and add-on allowlist | Prices respect min/standard/max semantics; AI add-ons must match provider allowlist. | `OfferAutopilotService`, offer tests | B3 |

### Phase D — AI transparency, safety, and evaluation

| # | Task | Outcome | Primary files/modules | Dependencies |
|---|------|---------|-----------------------|--------------|
| D1 | Integrate friendly clarification generation | Missing Details page uses concise AI wording while deterministic rules keep gates. | `generateUserFriendlyClarification`, Intent Card | A1 |
| D2 | Add unsupported/out-of-vertical handling | Non-alpha requests become clear unsupported states or copy, not malformed massage intents. | parser schema/prompt, server action, tests | A1 |
| D3 | Add confidence threshold policy | Very low-confidence required fields require confirmation even if non-null. | missing field rules, schemas, UI | A3 |
| D4 | Add prompt-injection and adversarial parse tests | Raw intents cannot override system instructions, leak prompts, or produce invalid DB writes. | `tests/unit/parsing.test.ts`, Claude/mock contract tests | D2 |
| D5 | Add AI evaluation fixtures | Golden messy-intent cases track parse accuracy, confidence, missing fields, and offer brief quality. | new `tests/evals` or unit fixtures | D2-D3 |
| D6 | Add AI fallback visibility | Admin/debug UI shows current provider, fallback count, validation failures, and last AI op. | admin route, trace queries | F2 |

### Phase E — Trust, memory, and reliability rewards

| # | Task | Outcome | Primary files/modules | Dependencies |
|---|------|---------|-----------------------|--------------|
| E1 | Build Preference Passport page | Users can view/edit defaults that influence future intents. | `/passport`, passport actions | A1 |
| E2 | Show memory provenance everywhere it matters | Intent fields prefilled from Passport/relationship are visibly labeled and editable. | Intent Card, parser confidence/provenance | E1, A3 |
| E3 | Add “Book again” from bookings | Relationship-aware rebooking becomes a visible user flow. | bookings page, create intent action | A7, E1 |
| E4 | Fix relationship count semantics | `rebookingCount` is renamed/documented or first completion increments appropriately. | `RelationshipService`, schema/migration/tests | A7 |
| E5 | Build reliability display components | Offer cards and bookings show transparent reliability scores and signal explanations. | `ReliabilityService`, shared components | A6-A7 |
| E6 | Add reliability rewards copy | Users/providers understand what improves reliability and what benefits it unlocks. | UX copy/components | E5 |
| E7 | Add memory/privacy controls | Users can clear Passport notes, relationship memory, and sensitive preferences. | passport/relationship actions | E1-E3 |

### Phase F — Auth, observability, and production hardening

| # | Task | Outcome | Primary files/modules | Dependencies |
|---|------|---------|-----------------------|--------------|
| F1 | Enforce role guards end-to-end | Provider/admin operations require server-side roles; user operations require ownership. | `auth`, server actions/routes/services | B2 |
| F2 | Build admin/debug dashboard | Admin can inspect intents, live intents, offers, bookings, traces, AI mode, and validation failures. | `/admin`, `MarketTraceService` | F1 |
| F3 | Enforce rate limits | Intent creation, activation, offer actions, and acceptance are rate-limited. | `rateLimit`, actions/middleware | F1 |
| F4 | Add E2E happy-path test | Browser test covers home → Intent Card → activate → provider send → inbox → accept → booking. | `tests/e2e`, Playwright config | A7, B2 |
| F5 | Add observability metrics dashboard | Funnel and market-quality metrics become inspectable: parse confidence, missing-field drop-off, liquidity, offer latency, acceptance, AI fallback. | admin dashboard, trace aggregation | F2 |
| F6 | Add mobile/a11y polish pass | All core routes have responsive layouts, keyboard navigation, labels, focus states, and empty/error/loading states. | all UI routes/components | all core UI routes complete |
| F7 | Add transaction/idempotency hardening | Activation, offer send, and offer accept resist duplicate submissions and retries. | services/actions/tests | A6, B2 |

## 5. Recommended immediate next session

Start with **A1: Build `/intents/[id]` Intent Card page**.

Why this first:

- It fixes the first broken redirect after the home form.
- It makes the AI visible instead of hidden.
- It unlocks mandatory completion, activation, low-liquidity preflight, and provenance display.
- It is the highest leverage bridge between the strong backend architecture and the product promise.

Definition of done for A1:

- `/intents/[id]` loads only for the owning user.
- It renders the raw input, parsed fields, missing mandatory fields, optional improvement suggestions, confidence/ambiguity notes, and current status.
- It handles not-found/forbidden states through existing domain errors or Next.js route behavior.
- It includes tests or at least a typecheck/lint pass.

## 6. Bedrock-grade acceptance criteria

Intentive should not be considered Bedrock-grade until the following are true:

- A user can complete the full canonical loop through UI without scripts.
- Every AI inference used for action is visible, editable, and confidence-aware.
- Provider attention is protected by correct matching and provider-side approval.
- Low/no liquidity is surfaced with actionable recovery options.
- Pricing, add-ons, travel radius, availability, and booking race-safety are covered by tests.
- Passport, relationship memory, and reliability signals are transparent and user-controllable.
- Auth, rate limits, expiry handling, admin observability, and E2E happy-path tests are in place.
