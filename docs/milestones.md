# MyProperty — Milestones & Deliverables

## Milestone 2 — Frontend MVP (Due: Friday, April 17)

### Deliverables

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

### Technical Requirements

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

### Decisions
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
  - `lib/auth/keycloak.ts` — mock Keycloak adapter (swappable)
  - `lib/api/client.ts` — axios instance with auth interceptor
  - `lib/api/endpoints.ts` — route constants (all placeholder, swappable)
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
  - `ui/` — Badge, Button, Card, DataTable, Input, Modal, Notification, Spinner, Textarea primitives
  - `tenant/dashboard/page.tsx`, `loading.tsx`, `error.tsx`
- Fixed dark mode bug — `@theme` inside `@media` is build-time only; dark token overrides moved to `@media (prefers-color-scheme: dark) { :root { ... } }`
- Fixed `Card.tsx` — replaced hardcoded hex values with CSS variable references
- Set up MSW v2 for development mock data (`mocks/`)
  - `mocks/fixtures/` — typed fixture data for all 4 endpoints
  - `mocks/handlers.ts` — MSW `http` handlers matching all API endpoints
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


#### Up Next
- M2.6 — Jest + RTL unit tests, Playwright e2e
- M2.7 — axe DevTools accessibility audit
- M2.9 — .cursorrules
- M2.10 — AI Log Entry #2