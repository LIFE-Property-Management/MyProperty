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

#### Up Next
- Tenant Portal UI (`app/(tenant)/`)