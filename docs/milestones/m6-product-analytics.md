# Milestone 6 — Product Analytics & Experimentation

**Status:** 🟡 In progress
**Aligns with:** PM-6 (Product Metrics), FS — Fullstack Integration
**Deliverable covered here:** **M6.1 — Analytics implementation** (PostHog integrated,
custom events tracking real user actions, conversion funnel set up).

> Other M6 deliverables (M6.2 North Star, M6.3 stakeholder dashboard, M6.4 A/B test,
> M6.5 OKRs, M6.6 feedback analysis, M6.7 final AI log) are tracked separately as
> they land. PostHog was chosen partly because it also covers M6.4 (experiments)
> from the same install.

## Goal

Instrument real user actions across both portals and stand up the data needed to
reason about the product funnel — acquisition through activation — without
bolting on a second SaaS for experiments later.

## Decision: PostHog over GA4

| | PostHog | GA4 |
|---|---|---|
| Funnels / paths / retention | First-class product-analytics UI | Marketing-oriented; funnel exploration is clunkier, data sampled |
| Custom events | Typed event model, autocapture + manual | Event + params, but reporting skews to acquisition |
| Experiments (M6.4) | Built in (feature-flag-backed A/B) | Needs Google Optimize successor / extra tooling |
| Hosting / data residency | EU cloud or self-host (fits our Keycloak/Grafana/Loki ethos) | Google-hosted; GDPR friction for tenant PII |
| Cost | Generous free tier | Free |

PostHog wins for a B2B SaaS whose core artifact is a **conversion funnel** and whose
next milestone is an **A/B test**. EU cloud is the default host (data residency for
tenant PII). Self-hosting remains an option (deferred — heavier: ClickHouse + Kafka +
Redis + Postgres).

## Architecture

Mirrors the existing `WebVitalsReporter` pattern: a thin, env-driven, **no-op-without-key**
client integration. Nothing about the app's behaviour changes when analytics is off.

```
lib/analytics/
  events.ts     ← event taxonomy (names + typed payload contracts) — single source of truth
  posthog.ts    ← facade: initAnalytics / capture / identifyUser / resetUser / capturePageview
  index.ts      ← public surface ("@/lib/analytics")

components/AnalyticsProvider.tsx
  ├─ initAnalytics() on mount
  ├─ PageviewTracker  → manual $pageview on App Router navigation (Suspense-wrapped)
  └─ IdentitySync     → identify on login / reset on logout (subscribes to useAuthStore)
```

- **`posthog.ts` is the only module that imports `posthog-js`.** Components and hooks call
  the typed facade, never the SDK directly. Every facade method is a guarded no-op until
  `initAnalytics()` runs with a key — so tests, CI, security scans, and key-less local dev
  all run with analytics cleanly disabled.
- **`capture()` is fully typed**: the event name constrains the payload via
  `AnalyticsEventProperties`. Events declared with no payload take no second argument
  (`capture(ANALYTICS_EVENTS.inviteOpened)`); events with a payload require it
  (`capture(ANALYTICS_EVENTS.propertyCreated, { propertyType })`). Adding an event to
  `ANALYTICS_EVENTS` without a payload contract is a compile error.
- **Identity** is keyed by the Keycloak `sub`, with `portal` + `email` as person
  properties. `IdentitySync` lives at the root layout, so it covers **both** the landlord
  and tenant portals without touching either `KeycloakInit`. `reset()` fires on logout so
  events aren't cross-attributed on shared devices.
- `person_profiles: "identified_only"` — anonymous visitors don't mint profiles (leaner
  data, lighter GDPR footprint).

## Event taxonomy

All events are defined in `frontend/lib/analytics/events.ts`. Naming: snake_case,
past-tense for completed actions, `*_started` for funnel-entry intents.

| Event | Properties | Fires when | Where (instrumentation point) |
|---|---|---|---|
| `signup_started` | — | Landlord opens the signup form | `app/(auth)/signup/page.tsx` (mount) |
| `signup_completed` | `method: "email"` | Registration request succeeds | `lib/hooks/auth/useSignupMutation.ts` |
| `property_created` | `propertyType` | A property is created | `lib/hooks/useCreateProperty.ts` |
| `tenant_invite_started` | `propertyId` | Landlord clicks "Invite Tenant" | `app/dashboard/properties/[id]/_components/PropertyDetailView.tsx` |
| `tenant_invited` | `propertyId` | Invite actually created/sent | **not yet wired** — invite-creation UI is a stub (see Known gaps) |
| `invite_opened` | — | Tenant opens an invite link | `app/invite/[token]/_components/InviteWizard.tsx` (mount) |
| `lease_reviewed` | — | Tenant advances past lease review | `InviteWizard.tsx` (step 0 → 1) |
| `invite_accepted` | — | Lease accepted + account created | `app/invite/[token]/_lib/useAcceptInvite.ts` |
| `payment_submission_started` | `method: receiptUpload \| manualRequest` | Payment modal opens | `app/(tenant)/_components/PaymentSubmissionModal.tsx` |
| `payment_receipt_submitted` | — | Receipt upload succeeds | `lib/hooks/useSubmitReceipt.ts` |
| `payment_manual_request_submitted` | — | Manual request succeeds | `lib/hooks/useSubmitManualRequest.ts` |

Page views (`$pageview`) are captured automatically on every navigation by
`PageviewTracker`, so funnels can also be built on URL steps.

## Conversion funnels

Built in the PostHog UI (Product Analytics → Funnels) from the events above. Definitions
are documented here so they can be recreated; PostHog funnels are configuration, not code.

### ★ Headline funnel — Landlord activation

The acquisition → activation path for the paying side of the marketplace.

| Step | Signal |
|---|---|
| 1. Visit | `$pageview` where path = `/` |
| 2. Signup intent | `signup_started` |
| 3. Account created | `signup_completed` |
| 4. First property | `property_created` |
| 5. First tenant invite (intent) | `tenant_invite_started` |

> Step 5 is **intent** today (click of "Invite Tenant"). When the invite-creation flow
> ships, repoint step 5 at `tenant_invited` for a true activation funnel.

### Tenant onboarding funnel

`invite_opened` → `lease_reviewed` → `invite_accepted`

### Payment-collection funnel

`payment_submission_started` → `payment_receipt_submitted` | `payment_manual_request_submitted`

### AARRR mapping (PM-6)

| Stage | Events |
|---|---|
| **Acquisition** | `$pageview` (`/`), `signup_started` |
| **Activation** | `signup_completed`, `property_created`, `tenant_invite_started` |
| **Retention** | `payment_*` (recurring rent loop), return `$pageview`s |
| **Referral** | `tenant_invite_started` / `tenant_invited` (landlord brings tenants in) |
| **Revenue** | `payment_receipt_submitted`, `payment_manual_request_submitted` |

(North Star metric — M6.2 — is defined separately, but the natural candidate from this
data is *active landlords collecting rent*, which the activation + payment events feed.)

## Configuration

Two optional `NEXT_PUBLIC_*` build-time vars (inlined by Next.js — see `lib/utils/env.ts`):

| Var | Required? | Default | Notes |
|---|---|---|---|
| `NEXT_PUBLIC_POSTHOG_KEY` | No | — (empty ⇒ analytics off) | PostHog **Project API Key** (`phc_…`); publishable, safe to inline |
| `NEXT_PUBLIC_POSTHOG_HOST` | No | `https://eu.i.posthog.com` | EU cloud by default; set to `https://us.i.posthog.com` or a self-host URL |

Deliberately **not** added to `requirePublicEnv()` — analytics is optional, so a missing
key must not fail the production build (unlike the API/Keycloak vars).

Wired through every build surface:

- **`frontend/Dockerfile`** — `ARG`/`ENV` (empty default).
- **`docker-compose.yml`** — build args (`NEXT_PUBLIC_POSTHOG_KEY` empty for local ⇒ off).
- **`.github/workflows/frontend-ci.yml`** — `NEXT_PUBLIC_POSTHOG_KEY=${{ secrets.NEXT_PUBLIC_POSTHOG_KEY }}`
  (optional repo secret; empty ⇒ off). Host hardcoded (non-secret).
- **`.github/workflows/security-ci.yml`** — key forced empty so ZAP/Lighthouse scan
  traffic never pollutes the analytics dataset.
- **`.env.example`**, **`frontend/.env.local.example`** — documented + commented.

**To turn analytics on:** create a PostHog project (EU), copy the Project API Key, and set
`NEXT_PUBLIC_POSTHOG_KEY` — as a repo secret for deployed builds, or in `.env` for local.
No code change required; the next build bakes it in.

## Privacy / GDPR

- EU-cloud host by default (tenant PII data residency).
- `identified_only` profiles — no anonymous-visitor profiles.
- Identity uses the opaque Keycloak `sub`; `email` is attached as a person property only
  for identified, authenticated users.
- Analytics is fully opt-in at the deployment level (no key ⇒ nothing is collected).

## Verification

- `frontend/lib/analytics/__tests__/posthog.test.ts` — facade no-ops without a key;
  forwards `init`/`capture`/`identify`/`reset`/`pageview` once configured; inits once.
- `frontend/components/__tests__/AnalyticsProvider.test.tsx` — init on mount, manual
  pageview with query string, identify-on-auth / reset-on-logout.
- `frontend/lib/hooks/auth/__tests__/useSignupMutation.test.tsx` — `signup_completed`
  fires on success, not on failure.
- Full suite green (473 tests). `next build` succeeds and the key inlines into the client
  bundle when set. `posthog-js` is globally mocked for Jest via `frontend/__mocks__/posthog-js.ts`.

## Deliverable status

| Item (M6.1) | Status |
|---|---|
| PostHog integrated | ✅ env-driven, no-op without key |
| Custom events tracking real user actions | ✅ 11-event taxonomy across both portals |
| Conversion funnel set up | ✅ landlord activation (headline) + 2 more, documented for the PostHog UI |

## Known gaps

- **`tenant_invited` not wired.** The invite-*creation* flow doesn't exist yet
  (`/dashboard/invites` is a stub; PropertyDetailView's "Invite Tenant" is a placeholder
  link). The funnel's final step is `tenant_invite_started` (intent) until then. The event
  is defined in the taxonomy; wire it into the create-invite mutation's `onSuccess` when
  that flow ships.
- Funnels themselves live in the PostHog project UI (configuration), recreatable from the
  definitions above — they are not committed as code.
- Server-side events (`posthog-node`) not added; the funnel is entirely client-driven, so
  the client SDK suffices for M6.1.
