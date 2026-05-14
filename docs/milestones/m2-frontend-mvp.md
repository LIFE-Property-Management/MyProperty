# Milestone 2 — Frontend MVP

**Status:** ✅ Complete (with documented debt — see Known Gaps)
**Due:** Friday, April 17, 2026
**Closed:** April 22, 2026 (audit-verified)

> This file is frozen. Subsequent work on issues raised here is tracked in the next active milestone's "Inherited debt" section.

## Deliverables

| ID | Deliverable | Description |
|---|---|---|
| M2.1 | Next.js project scaffolded | App Router, TypeScript strict mode, Tailwind configured, ESLint + Prettier |
| M2.2 | Core UI components | Design system: buttons, inputs, modals, cards, navbars, data tables — all responsive, dark mode |
| M2.3 | Routing & layouts | All main routes with App Router (`layout.tsx`, `loading.tsx`, `error.tsx`), protected routes ready |
| M2.4 | Forms with validation | Multi-step form wizard with React Hook Form + Zod, file upload UI |
| M2.5 | State management | TanStack Query for server state, Zustand for client state, devtools integrated |
| M2.6 | Frontend tests | Jest + RTL unit tests, Playwright e2e for one complete user flow, running in CI |
| M2.7 | Accessibility audit | axe DevTools audit report, all critical violations fixed, keyboard navigation working |
| M2.8 | Performance baseline | Lighthouse report, Web Vitals measured, bundle analysis, code splitting implemented |
| M2.9 | .cursorrules for React | Project-specific AI rules configured, documented productivity measurement |
| M2.10 | AI Log Entry #2 | Document AI usage for component generation, debugging, accessibility fixes |

## Technical Requirements

| ID | Requirement | Implementation Detail |
|---|---|---|
| FE-1 | TypeScript strict mode | Generics, utility types, type guards — no `any` escape hatches |
| FE-2 | Advanced React patterns | Custom hooks (`useFetch`, `useDebounce`, etc.), `useReducer` for complex state |
| FE-3 | Tailwind CSS throughout | Mobile-first responsive design, dark mode, custom theme config |
| FE-4 | State management | TanStack Query for server state + Zustand for client state |
| FE-5 | Next.js App Router | File-based routing, Server Components, Server Actions, SSR/SSG/ISR |
| FE-6 | Forms with validation | React Hook Form + Zod, multi-step wizard, dynamic fields, file upload |
| FE-7 | Testing | Jest + React Testing Library (unit/integration) + Playwright (e2e), CI-ready |
| FE-8 | Accessibility | WCAG 2.1 AA compliant, axe DevTools audit passing, keyboard navigation |
| FE-9 | Performance optimized | `React.memo`/`useMemo`, code splitting, lazy loading, Web Vitals measured |
| FE-10 | Real-time UI | **Intentionally omitted** — TanStack Query polling used instead (see CLAUDE.md) |
| FE-11 | AI dev workflow | `.cursorrules` configured for React monorepo, measured productivity impact |
| FE-12 | Framer Motion | Basic animations: page transitions, component mount/unmount |

## Decisions

- **Client state: Zustand** — not Redux. Limited client-side state needs (UI state, user role, notifications) don't justify Redux overhead.
- **Server state: TanStack Query** — all API data fetching, caching, and sync. No raw `fetch` or `useEffect` data fetching.

## Progress Log

### April 15, 2026

#### Completed
- Upgraded Next.js to 16.2.3 (patched DoS vulnerability)
- Removed deprecated `@next/font`, migrated to `next/font`
- Installed all missing dependencies: `zod`, `zustand`, `@tanstack/react-query`, `@tanstack/react-query-devtools`, `react-hook-form`, `@hookform/resolvers`, `framer-motion`
- Fixed `globals.css` — correct design system color tokens, Playfair Display + DM Sans fonts, dark mode
- Completed all Zod schemas for Tenant Portal (`lib/types/`)
    - `enums.ts` — PaymentStatus, PaymentMethod, LeaseStatus, TenantAccountStatus
    - `lease.ts` — LeaseSummary (depositAmount intentionally excluded from MVP)
    - `payment.ts` — Payment, ReceiptUploadFormSchema, ManualRequestFormSchema, PaymentHistoryEntry, PaymentHistoryResponse
    - `tenant.ts` — TenantAccount
    - `index.ts` — barrel exports

### April 16, 2026

#### Completed
- Completed Zustand store for Tenant Portal (`lib/store/`)
    - `tenant/authSlice.ts` — userId, email, tenantAccountStatus, isReadOnly (derived), setAuth, clearAuth
    - `tenant/uiSlice.ts` — UI state
    - `tenant/notificationSlice.ts` — notifications with auto-dismiss
    - `useTenantStore.ts` — combined store with devtools middleware
- Completed TanStack Query + data layer setup
    - `lib/auth/keycloak.ts` — mock Keycloak adapter (swappable; tenant-only payload shape — see Known Gaps)
    - `lib/api/client.ts` — axios instance with auth interceptor
    - `lib/api/endpoints.ts` — route constants (tenant + invite endpoints; landlord endpoints not yet added)
    - `lib/hooks/queryKeys.ts` — centralized query key factory
    - `lib/hooks/useTenantAccount.ts`
    - `lib/hooks/useLease.ts`
    - `lib/hooks/useCurrentPayment.ts` — 30s polling
    - `lib/hooks/usePaymentHistory.ts` — paginated
    - `lib/hooks/useSubmitReceipt.ts` — multipart mutation
    - `lib/hooks/useSubmitManualRequest.ts` — JSON mutation
    - `lib/hooks/index.ts` — barrel export
    - `app/(tenant)/_components/KeycloakInit.tsx`
    - `app/(tenant)/layout.tsx`

### April 17, 2026

#### Completed
- Built Tenant Portal UI (`app/(tenant)/`)
    - `_components/LeaseSummaryCard.tsx` — lease details card
    - `_components/LeaseSummarySection.tsx` — data-fetching wrapper
    - `_components/PaymentSection.tsx` — current payment with 4 states (Outstanding, Pending, Confirmed, Rejected)
    - `_components/PaymentSubmissionModal.tsx` — modal with tab switch between receipt upload and manual request
    - `_components/ReceiptUploadForm.tsx` — file upload form with React Hook Form + Zod
    - `_components/ManualRequestForm.tsx` — cash payment form with React Hook Form + Zod
    - `_components/PaymentHistoryTable.tsx` — filterable, paginated history table
    - `_components/ReadOnlyBanner.tsx` — post-lease read-only state indicator
    - `_components/PageTransition.tsx` — Framer Motion page animation
    - `_components/ui/` — Badge, Button, Card, DataTable, Input, Modal, Notification, Spinner, Textarea primitives (⚠️ duplicates of root `components/ui/` — see Known Gaps)
    - `tenant/dashboard/page.tsx`, `loading.tsx`, `error.tsx`
- Built shared primitives at `components/ui/` (root) — Button, Card, DataTable, Input, Modal, Navbar — token-compliant versions intended as the canonical set. Tenant portal did not migrate to these; duplication tracked under Known Gaps.
- Built root-level chrome: `app/page.tsx` (landing), `app/layout.tsx`, `app/not-found.tsx`, `app/loading.tsx`, `app/error.tsx`, `app/components/LandingPage.tsx`
- `middleware.ts` — protected-route middleware scaffold
- Fixed dark mode bug — `@theme` inside `@media` is build-time only; dark token overrides moved to `@media (prefers-color-scheme: dark) { :root { ... } }`
- Fixed `Card.tsx` — replaced hardcoded hex values with CSS variable references
- Set up MSW v2 for development mock data (`mocks/`)
    - `mocks/fixtures/` — typed fixture data for tenant endpoints: `tenantAccount`, `lease`, `currentPayment` (Outstanding state only), `paymentHistory` (11 entries)
    - `mocks/handlers.ts` — MSW `http` handlers for the 6 tenant endpoints; in-memory state supports Outstanding → Pending transition only
    - `mocks/browser.ts` — service worker setup
    - `mocks/MockProvider.tsx` — client component that gates rendering until worker is registered
    - Integrated into `app/(tenant)/layout.tsx`
- Confirmed all sections render with mock data: Lease Summary, Current Payment (Outstanding state), Payment History (11 entries, paginated)
- Completed performance baseline (M2.8 / FE-9)
    - Added `@next/bundle-analyzer` + `cross-env` (devDeps); wired `withBundleAnalyzer` in `next.config.ts` behind `ANALYZE=true` flag
    - New `npm run analyze` script — uses `next build --webpack` (Turbopack not yet compatible with bundle analyzer)
    - `components/WebVitalsReporter.tsx` — registers `useReportWebVitals` in root layout; logs to console in dev, `sendBeacon` to `NEXT_PUBLIC_WEB_VITALS_ENDPOINT` in prod (no-op if unset)
    - `app/dashboard/page.tsx` — `next/dynamic` import for `LandlordDashboard` with loading skeleton; ships as a separate ~10 KB chunk instead of inflating the route's initial payload
    - Lighthouse baseline (all green):

      | Page | Perf | A11y | Best Practices | SEO | LCP | CLS | TBT |
          |---|---|---|---|---|---|---|---|
      | `/` | 97 | 98 | 100 | 100 | 2.7 s | 0 | 40 ms |
      | `/dashboard` | 97 | 89 | 96 | 100 | 2.7 s | 0 | 20 ms |

    - All artefacts checked in under `docs/performance/`: `lighthouse-home.report.{html,json}`, `lighthouse-dashboard.report.{html,json}`, `bundle-{client,nodejs,edge}.html`, `README.md`
    - Dashboard a11y score of 89 is the intentional baseline lever for M2.7 — captured now so the fix is measurable

#### Completed — M2.6 Frontend tests
- Jest + RTL unit tests under `__tests__/` directories:
    - `components/ui/__tests__/` — Button, Card, DataTable, Input, Modal, Navbar
    - `app/(tenant)/_components/__tests__/` — LeaseSummaryCard, PaymentHistoryTable, PaymentSection, and others
    - `lib/auth/__tests__/keycloak.test.ts`
    - `lib/hooks/__tests__/queryKeys.test.ts`, `useQueries.test.tsx` (integration across all 6 query hooks)
    - `lib/store/__tests__/tenantStore.test.ts`
    - `lib/types/__tests__/` — enums, lease, payment, tenant schema tests
    - `__tests__/middleware.test.ts`, `__tests__/smoke.test.ts`
- `test-utils/renderWithQuery.tsx`, `test-utils/resetTenantStore.ts` — shared test harness
- `jest.config.mjs`, `jest.setup.ts`, `jest.polyfills.ts` configured
- Playwright e2e — `e2e/tenant-receipt-upload.spec.ts` covers the receipt-upload flow with fixture PDF at `e2e/fixtures/receipt.pdf`
- `playwright.config.ts` configured
- npm scripts: `test`, `test:watch`, `test:coverage`, `test:e2e`, `test:e2e:ui`, `test:e2e:install`
- 
#### Completed — Landlord portal scaffold (M2.3 extension)
- `app/dashboard/page.tsx` — dynamic import wrapper (originally logged April 17)
- `app/dashboard/LandlordDashboard.tsx` — dashboard UI with Overview, Overdue Payments, Leases Expiring Soon, Recent Payments, Upcoming Payments (paginated) sections using hardcoded mock data
- `app/dashboard/LandlordLayout.tsx` — collapsible sidebar + topbar + user menu chrome
- `app/dashboard/layout.tsx`, `loading.tsx`, `error.tsx`
- **Status:** functional but does not meet CLAUDE.md styling rules — uses inline `style={{}}` with hardcoded hex constants, no Tailwind, no design tokens, no `dark:` variants, no responsive breakpoints. Scheduled for rewrite. See Known Gaps.

#### Completed — Invite acceptance flow (M2.4)
- `app/invite/[token]/page.tsx` — server component, resolves token param, passes to wizard
- `app/invite/[token]/_components/` — `InviteWizard`, `StepIndicator`, `ReviewStep`, `AcceptStep`, `AccountStep`, `SuccessStep`
- `app/invite/[token]/_lib/invite.ts` — `InvitePreview` type + `mockInvitePreview()` stub
- `app/invite/[token]/_lib/schema.ts` — Zod schemas for the 3-step wizard (lease acceptance → signature/ID → password)
- `app/invite/[token]/_lib/useAcceptInvite.ts` — TanStack Query mutation calling `POST /invites/:token/accept`
- Invite endpoints added to `lib/api/endpoints.ts`: `inviteByToken`, `acceptInvite`
- Styling and token usage compliant with CLAUDE.md
- **Status:** lease-acceptance-before-account ordering correct, but only covers 1 of 3 invite-flow cases from `portals.md` (new user only; existing-user-not-logged-in and existing-user-already-logged-in not handled) and 0 of 4 invite statuses (no handling for Accepted/Rejected/Expired tokens). Schema and hook live under `_lib/` rather than `lib/types/` and `lib/hooks/` — bypasses the M2 data-layer convention. To be completed in the next milestone.

#### Completed — M2 close
- Created `docs/audits/m2-m3-audit/part1-structural.md` — duplicate UI primitives, CLAUDE.md compliance on landlord code, invite flow review, cross-portal import check
- Created `docs/audits/m2-m3-audit/part2-readiness.md` — M3 readiness gaps, type-safety leaks, dead code, progress-log accuracy
- Corrected this milestone log to reflect actual M2 code state
- Closed M2 with documented debt (see Known Gaps)

## Deliverable Status (at close)

| ID | Status | Notes |
|---|---|---|
| M2.1 | ✅ | |
| M2.2 | ⚠️ partial | Components exist but duplicated across two `ui/` folders; landlord chrome violates rules |
| M2.3 | ✅ | Root + tenant + landlord + invite layouts all present |
| M2.4 | ⚠️ partial | Invite wizard exists but only 1 of 3 cases handled |
| M2.5 | ⚠️ partial | Tenant store complete; landlord store missing |
| M2.6 | ✅ | Jest + RTL unit tests + Playwright e2e for receipt upload |
| M2.7 | ⏳ open | Dashboard a11y at 89 — fix planned |
| M2.8 | ✅ | Lighthouse + bundle analyzer + Web Vitals |
| M2.9 | ⏳ open | `.cursorrules` not created |
| M2.10 | ⏳ open | AI Log Entry #2 not written |

## Known Gaps at M2 close

These were accepted as M2-complete-with-debt and handed forward. See the active milestone's "Inherited debt" section for resolution status.

### Styling / design-system debt
- **Duplicate `ui/` directories** — `components/ui/` (root, token-compliant) and `app/(tenant)/_components/ui/` (feature-richer but uses inline hex and arbitrary Tailwind values). Tenant portal uses the tenant version; landlord dashboard uses neither. Resolution: consolidate into `components/ui/` with the better features merged in; delete tenant `ui/`; migrate imports.
- **Landlord dashboard + layout violate CLAUDE.md styling rules** — inline `style={{}}` everywhere, hardcoded hex constants, no Tailwind, no tokens, no `dark:` variants, no responsive breakpoints. Resolution: rewrite from scratch using the compliant tenant portal as the model.
- **Invented colors** — `TEXT = "#1a1a1a"` (spec: `#111111`) and `ERROR = "#b91c1c"` (spec: `#931F1D`) appear in landlord files. Eliminated when landlord files are rewritten.

### Data-layer debt
- **Keycloak mock is tenant-only** — `lib/auth/keycloak.ts` `DecodedPayload` has only `tenantAccountStatus`; `initKeycloak` unconditionally writes to the tenant store. Must be generalized before any landlord auth work. Resolution: discriminated union for payloads, role-aware `setAuth` routing, per-role dev JWTs.
- **No landlord store** — `lib/store/landlord/` does not exist. Needed: `authSlice`, `uiSlice`, `notificationSlice`, `useLandlordStore`.
- **No landlord endpoints, types, or MSW handlers** — `lib/api/endpoints.ts`, `lib/types/`, `mocks/` all tenant-only.
- **Payment confirmation flow missing end-to-end** — no `/landlord/payments/:id/confirm` or `/reject` endpoint, no `useConfirmPayment` / `useRejectPayment` hook, no MSW handler. Tenant UI has the `Confirmed` and `Rejected` states wired up but they are unreachable from current mocks.
- **Invite flow partial** — only 1 of 3 user cases and 0 of 4 invite statuses handled; `mockInvitePreview` bypasses TanStack Query + Zod entirely; schema/hook misplaced under `_lib/`.

### MSW coverage gaps
- Only `Outstanding` payment state reachable initially; `Pending` reachable via mutation; `Confirmed` and `Rejected` unreachable (blocked by missing confirmation flow above). No dev switch for starting state.
- `useSubmitReceipt` discards the file server-side and doesn't populate `receiptFileName` / `receiptFileUrl` on the fixture.

### Latent bugs
- `useSubmitReceipt.ts` manually sets `"Content-Type": "multipart/form-data"` on axios, which strips the auto-generated boundary. Works against MSW (which doesn't care), will 400 against a real backend. Resolution: delete the header line, let the browser/axios set it.

### Dead / misplaced code
- `useTenantAccount` hook has zero production consumers (only the barrel re-exports it). Either wire it up or delete.
- `components/ui/DataTable`, `Modal`, `Navbar` have zero production consumers (tenant portal uses its own `ui/` copies instead). Consolidating `ui/` folders resolves this.
- `PaymentMethod` inferred type has zero production consumers.

### Type safety exceptions
6 uses of `any` / `as unknown` total, all in test infrastructure (`jest.polyfills.ts`, `jest.setup.ts`, middleware test, 3 tenant component tests) and all annotated with `eslint-disable` comments explaining why. No production code uses `any`.

### Documentation debt (resolved at M2 close)
The following work shipped during M2 but was not in the original progress log (added retroactively in the corrected log above): landlord dashboard files, invite flow files, middleware, root-level routing (`page.tsx`, `not-found.tsx`, `loading.tsx`, `error.tsx`, `LandingPage.tsx`), invite endpoints in `endpoints.ts`, the full test suite (M2.6), and the shared `components/ui/` set.