# Intentive — Product Vision & Principles

> Canonical document. Changes here ripple into every downstream decision.
> Last updated: 2026-06-21

## 1. One-line definition

**Intentive turns messy human intent into a market-actionable object, activates the right supply, and returns a few reasoned offers the user can choose from with confidence.**

It is *not* a booking app, *not* a provider directory, *not* a package browser, and *not* a chatbot wrapper.

## 2. The core mantra

> Messy human intent becomes a market-actionable object. The platform activates the right supply. Providers approve AI-suggested offers. Users receive a few reasoned choices. Every transaction strengthens trust, preference memory, and future market quality.

## 3. The product loop (canonical)

```
Messy intent in
  → structured request out (Intent Object → Intent Card)
  → live market activated (Live Intent → matched supply)
  → reasoned offers received (Provider Offer Autopilot → Offer Inbox)
  → user chooses confidently (Accept → Booking)
  → relationship + reliability strengthened (Relationship Asset, Reliability Signals)
```

Every screen, service, and data structure must serve this loop. If a feature does
not move intent toward a confident choice, it does not belong in the alpha.

## 4. Alpha scope: one vertical

**Same-day massage / wellness services.** One vertical, end-to-end, done well.
No generic marketplace. No multi-category abstraction beyond what keeps the
domain clean. Locations modeled on KL / PJ.

## 5. Design principles

1. **Intent is the unit of work, not search.** The primary input is a single
   free-text intent box. We never lead with "search providers" or a browsable
   catalog. The catalog is an implementation detail of matching, never a UX.

2. **Show what the AI understood.** Parsing is always visible as an editable
   Intent Card. The user is never surprised by what we inferred. Inferred
   preference defaults are shown and editable, never silently applied.

3. **Ask only for mandatory blockers.** Before activation we ask *only* for the
   fields that block a market from forming. Optional fields live under "Improve
   your offers" and never gate activation. Do not over-ask.

4. **Protect provider attention.** Never notify all providers. Invite only the
   top 3–5 eligible providers per Live Intent. Weak or incomplete intents are
   never sent to providers.

5. **Providers approve, AI suggests.** The Provider Offer Autopilot drafts a
   structured Suggested Offer from provider policy + availability + intent.
   In alpha a human provider must Approve / Edit / Decline before send.
   Fully automatic send is off by default (`autoSendEnabled = false`).

6. **A few reasoned choices, not a long list.** The Offer Inbox returns
   structured offer cards, ranked, highlighting at most three:
   Recommended, Best Value, Fastest / Most Convenient. Each carries a
   Reasoned Offer Brief. No endless scroll.

7. **Deterministic business rules; AI at the edges.** Pricing, eligibility,
   matching, and state transitions are deterministic and testable. AI handles
   language understanding and drafting. **AI never mutates the database** — it
   returns structured JSON validated by Zod before any use.

8. **Safe state, always.** Every domain object moves through an explicit state
   machine. Invalid transitions throw typed domain errors. No scattered status
   mutations.

9. **Trust is the compounding asset.** Every completed transaction updates
   Relationship Assets, Preference Passport memory, and Reliability Signals.
   The market gets better with use.

10. **Transparent, explainable, fair.** Reliability rewards are explained in
    plain language. **No opaque personalized pricing.** We never infer income,
    device quality, neighborhood wealth, or willingness-to-pay from sensitive
    or proxy attributes.

11. **Honest liquidity.** Low-supply / no-supply states are surfaced, never
    hidden. We tell the user how to widen time, radius, or fulfillment mode to
    get more offers.

12. **Bedrock-grade posture.** Typed architecture, clean domain model, robust
    validation, server-side authorization, transaction boundaries, race-safe
    booking, observability hooks, and test coverage are non-negotiable even in
    alpha.

## 6. Canonical product language

These exact terms appear in the UI and code. Generic synonyms are banned in
user-facing surfaces.

| Term | Meaning |
|------|---------|
| **Intent Object** | The structured representation of a user's need. |
| **Intent Card** | The visible, editable rendering of an Intent Object. |
| **Missing Details** | Mandatory blockers not yet resolved. |
| **Market-Actionable** | All mandatory blockers resolved; ready to go live. |
| **Live Intent** | An activated Intent Object inviting matched supply. |
| **Offer Inbox** | Where the user receives structured offers. |
| **Suggested Offer** | An AI-drafted offer awaiting provider approval. |
| **Provider Offer Autopilot** | The service that drafts Suggested Offers. |
| **Reasoned Offer Brief** | The plain-language explanation attached to an offer. |
| **Reliability Rewards** | Transparent benefits for reliable behavior. |
| **Relationship Asset** | Accumulated history between a user and a provider. |
| **Preference Passport** | A user's editable default preferences. |

Banned as primary UX: "search providers", "browse packages", open-ended chat.

## 7. Authorization model (non-negotiable)

- Users see only their own Intent Objects, Live Intents, Offers, Bookings.
- Providers see only Live Intents they were invited to, and their own offers.
- Admin sees all.
- All checks are server-side. Client state is never trusted.
- Raw AI prompts are never exposed in the UI.

## 8. Definition of "alpha done"

The app runs locally with a single command (after setup), with mock AI when no
key is present, and supports the full happy path end-to-end:

> User creates a Thai massage intent → completes missing details → activates a
> Live Intent → a provider approves a suggested offer → the user accepts →
> a Booking is created → completion writes a Relationship Asset and updates
> reliability signals.

…with unit tests on the domain core and at least one E2E test on the happy path.

## 9. Explicit non-goals for alpha

- Provider browsing / search as primary UX.
- Open-ended chatbot as the core interaction.
- Sending weak/incomplete intents to providers.
- Notifying all providers.
- Auto-sending offers without approval (unless explicitly enabled per provider).
- Opaque or proxy-based personalized pricing.
- Multi-vertical generalization beyond clean domain seams.
