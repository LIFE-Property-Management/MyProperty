# MyProperty — Frontend CLAUDE.md

## Project Overview

**MyProperty** is a property management SaaS built for small and remote landlords in the Balkans region who manage residential properties. The platform serves two distinct user roles — **Landlord** and **Tenant** — each with their own dashboard, flows, and access rules.

The frontend is built with **Next.js (App Router)** and **TypeScript**.

---

## Design System

### Brand Colors
- **Primary:** `#275D2C` (green) — used for primary actions, active states, branding
- **Background:** `#fbfbff`
- **Do NOT use red (`#931F1D`) as a brand color.** Red is reserved exclusively for semantic error/danger states throughout the UI. This was a deliberate decision to prevent color ambiguity.

### Typography
- **Headings / Display:** Playfair Display
- **Body / UI:** DM Sans

### Color Tokens

| Token | Light | Dark |
|---|---|---|
| Background | `#fbfbff` | `#0d1117` |
| Surface (cards, tables) | `#ffffff` | `#161b22` |
| Border | `#e5e7eb` | `#30363d` |
| Primary (buttons, links) | `#275D2C` | `#3fb950` |
| Primary text | `#111111` | `#f0f6fc` |
| Muted text | `#6b7280` | `#8b949e` |
| Error / Danger | `#931F1D` | `#f85149` |

**Contrast compliance:**
- Primary text: 19.5:1 light / 15.3:1 dark → **AAA**
- Primary button: 8.2:1 light / 8.1:1 dark → **AAA**
- Error color: 7.4:1 light / 5.1:1 dark → AAA light, AA dark (acceptable — error states always include an icon or label, never color alone)
- Muted text: ~5.9:1 light / ~4.8:1 dark → **AA** (intentional — pushing muted text to AAA would collapse visual hierarchy)

### General UI Rules
- Tenant names are **always clickable links** to the Tenant Detail page, everywhere they appear in the app — tables, cards, logs, everywhere.
- Design should feel clean and intuitive for non-technical users (landlords who may be managing remotely).

---

## Architecture & Routing

- Uses Next.js **App Router**.
- Two role-based portal areas: Landlord and Tenant. Keep them clearly separated in the folder structure.
- No unit-layer distinction in the UI — each property represents a single unit.

---

## Authentication & Invite Flow

Authentication is handled by **Keycloak** on the backend. The frontend must support the following invite flow states:

- **Tenants cannot self-register.** Only landlords can invite tenants via email.
- The invite flow handles three cases:
    1. New user (no existing account)
    2. Existing user, not logged in
    3. Existing user, already logged in
- The **lease acceptance screen comes before** account creation or password setup.
- Invite statuses: `Pending`, `Accepted`, `Rejected`, `Expired`

---

## Landlord Portal

### Dashboard (`/dashboard`)
- **Stat cards:** Total Properties, Total Active Tenants
- **Action tables (require attention):**
    - Overdue Payments
    - Leases Expiring Soon (threshold: 30 days)
- **Summary tables:**
    - Recent Payments (last 5)
    - Upcoming Payments (next 30 days, with pagination)

### Tenants Page
- Tenant List table
- Collapsible **Invitation Log** — shows only `Pending`, `Rejected`, and `Expired` invites (not Accepted)
- A **banner alert** appears when there are pending invites; clicking it scrolls to and expands the Invitation Log

### Tenant Detail Page
- Summary card for the tenant
- Last payment date stat
- Payment History table (filterable)

---

## Tenant Portal

### Dashboard
- **Lease Summary card**
- **Payment Section** with four states:
    - `Outstanding` — payment is due
    - `Pending` — tenant has submitted proof, awaiting landlord confirmation
    - `Confirmed` — landlord has confirmed payment
    - `Rejected` — landlord has rejected the submission
- Tenants submit payment proof via:
    - **Receipt upload** (digital payment)
    - **Manual request** (cash payment)
- **Landlord has final authority** over payment confirmation — tenants cannot self-confirm.
- **Payment History table**

---

## Data & Access Rules (Frontend Implications)

- Tenants who have ever had an active lease are **never auto-deleted**. After lease expiry, their accounts persist with **read-only access**.
- Orphaned records (invite never opened, no lease created, Keycloak account never activated) are auto-deleted after 30 days — the frontend does not need to surface this, but should not mislead users about data permanence.
- Post-lease tenant accounts: show as read-only, not as deleted or inactive.
- Access control is **status-based**, not role-deletion-based.

---

## Components Built So Far

| File | Description |
|---|---|
| `app/components/LandingPage.tsx` | Landing page with three client-side views: Landing, Login, Signup. Includes client-side form validation. |
| `app/dashboard/LandlordDashboard.tsx` | Main landlord dashboard component |
| `app/dashboard/LandlordLayout.tsx` | Layout wrapper for the landlord portal |
| `app/dashboard/page.tsx` | Dashboard route page |
| `app/layout.tsx` | Root layout |
| `app/page.tsx` | Root page (likely renders LandingPage) |
| `app/globals.css` | Global styles |

---

## Environment Variables

> ⚠️ Structure TBD — to be filled in once backend is configured. Use these placeholders for now.

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:XXXX
NEXT_PUBLIC_KEYCLOAK_URL=http://localhost:XXXX
NEXT_PUBLIC_KEYCLOAK_REALM=PLACEHOLDER
NEXT_PUBLIC_KEYCLOAK_CLIENT_ID=PLACEHOLDER
```

All frontend-consumed variables must be prefixed with `NEXT_PUBLIC_`. Do not add unprefixed secrets here unless they are server-only.

---

## API Communication

> ⚠️ Convention TBD — to be agreed with backend team. Placeholder rules below.

- The frontend will communicate with the .NET backend via **REST**.
- Base URL comes from `NEXT_PUBLIC_API_BASE_URL`.
- All authenticated requests include the Keycloak token in the `Authorization: Bearer <token>` header.
- All data fetching goes through **TanStack Query** — no raw `fetch` or `useEffect`-based data fetching.
- Whether calls are direct or proxied through Next.js Route Handlers is **yet to be decided** — do not hardcode either pattern until confirmed.

---

## Key Decisions & Rules

- **Never use red as a brand or accent color.** It is strictly for error states (form errors, destructive actions, failed payment status, etc.).
- **v0.dev was intentionally opted out of** — do not suggest or use it. Components are generated directly.
- Tailwind CSS is used for styling (via PostCSS config).
- TypeScript is enforced — no `any` types without justification.
- When building tables with tenant names, always wrap the name in a `<Link>` pointing to the Tenant Detail page.
- Keep Landlord and Tenant portal code clearly separated — do not mix concerns.

### Responsive Design
- **Mobile-first** — all styles written for mobile base, then scaled up.
- **Three breakpoints only:**
    - Base (unsuffixed) — mobile
    - `md` (768px) — tablet: sidebar appears, layout shifts
    - `lg` (1024px) — desktop: primary landlord experience
- Do not use `sm`, `xl`, or `2xl` breakpoints unless there is a specific justified reason.

### Dark Mode
- Implemented via **`prefers-color-scheme` media query** — not class-based toggle.
- Use Tailwind's `dark:` variant throughout. No manual media query CSS unless Tailwind cannot handle it.
- All dark mode color values are defined in the token table above — use those exact values in the Tailwind theme config. Do not invent new dark mode colors.

### SignalR — Deliberately Not Implemented
FE-10 (real-time UI via SignalR) has been **intentionally omitted**. Reason: all real-time events in this domain (payment submissions, lease changes) are low-frequency. TanStack Query's `refetchOnWindowFocus` and optional polling provide equivalent data freshness without the infrastructure overhead of a persistent WebSocket connection. This decision should be revisited if the product scope changes significantly.

---

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
| FE-4 | State management | TanStack Query for server state + **Zustand** for client state |
| FE-5 | Next.js App Router | File-based routing, Server Components, Server Actions, SSR/SSG/ISR |
| FE-6 | Forms with validation | React Hook Form + Zod, multi-step wizard, dynamic fields, file upload |
| FE-7 | Testing | Jest + React Testing Library (unit/integration) + Playwright (e2e), CI-ready |
| FE-8 | Accessibility | WCAG 2.1 AA compliant, axe DevTools audit passing, keyboard navigation |
| FE-9 | Performance optimized | `React.memo`/`useMemo`, code splitting, lazy loading, Web Vitals measured |
| FE-10 | Real-time UI | SignalR client integration with React hooks for live updates |
| FE-11 | AI dev workflow | `.cursorrules` configured for React monorepo, measured productivity impact |
| FE-12 | Framer Motion | Basic animations: page transitions, component mount/unmount |

### Decisions Made
- **Client state library: Zustand** (not Redux). The app has limited client-side state needs — UI state, current user role, notifications. Redux overhead is not justified for this scope.
- **Server state: TanStack Query** — all API data fetching, caching, and synchronisation goes through TanStack Query, not raw `fetch` or `useEffect` data fetching patterns.

---

## What the Backend Handles (Do Not Reimplement on Frontend)

- Authentication & session management → **Keycloak**
- Invite email sending and token validation → **.NET backend**
- Scheduled jobs (orphan cleanup, expiry checks) → **Hangfire**
- Payment confirmation authority → **backend only**, tenant UI should reflect state, not control it

