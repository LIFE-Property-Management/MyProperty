# ADR-0006: Next.js App Router over Remix / SvelteKit / plain React+Vite

- **Status:** Accepted (M2.1, 2026-Q1)
- **Deciders:** Full Team
- **Reflected in:** [`containers.md`](../containers.md), [`deployment-dev.md`](../deployment-dev.md), [`deployment-prod.md`](../deployment-prod.md)

## Context

M2.1 + M2.3 + M2.5 mandate **Next.js with App Router, TypeScript strict, Tailwind**, plus a state-management stack (TanStack Query + Zustand) and the ability to ship SSR/SSG/ISR. The milestones doc bakes in *Next.js as the chosen framework* — but the decision still needs justification against the obvious alternatives so the rest of the architecture aligns.

## Decision

Adopt **Next.js 16 with App Router**, **React 19**, **TypeScript strict**, **Tailwind 4**. The frontend ships as a **standalone production bundle** (`output: 'standalone'` in `next.config.ts`) hosted in a **distroless Node 20 image** running as UID 65532.

Bundle is built into a distroless image inside `frontend/Dockerfile` (three-stage: deps → builder → runner). `NEXT_PUBLIC_*` env vars are inlined at *build* time as docker `--build-arg`s — so the bundle the browser downloads already has the right `NEXT_PUBLIC_API_BASE_URL` and `NEXT_PUBLIC_KEYCLOAK_*` URLs.

## Consequences

### Positive

- **App Router + RSC + SSR + ISR + Server Actions in one framework** — no need to bolt SSR onto a CSR framework, no need to learn two routing models.
- **Largest React ecosystem.** Every library we picked (TanStack Query, React Hook Form, Zod, keycloak-js, Framer Motion, MSW) is documented against Next.js out of the box.
- **`next/font/google` ships the two fonts (Playfair Display + DM Sans) with optimal CLS** — single layout-shift-free load.
- **`next.config.ts`'s `output: 'standalone'`** produces a ~90% smaller Docker image than the default. Distroless + standalone is what gets us a sub-200 MB final image.
- **Playwright + MSW + dev-auth bypass** stack works cleanly with Next's dev server (the e2e harness auto-spawns `next dev` per `playwright.config.ts`).
- **Builds match prod**: the same `Dockerfile` is used in `frontend-ci.yml` and via `docker compose build`.

### Negative

- **App Router learning curve** — server components vs client components, the `"use client"` directive, the cache + revalidation primitives. We've all encountered the foot-guns at least once.
- **React 19 is recent.** Some libraries lag on peer dependency declarations (we hit this with `keycloak-js` types).
- **Build-time inlining of `NEXT_PUBLIC_*` env vars** means we cannot move URLs between environments without a rebuild. This is a known Next.js trade-off, not a bug.

### Mitigations

- The `frontend/CLAUDE.md` documents the App Router patterns the project uses + the Server-vs-Client component decision tree.
- For the URL-rebuild constraint, the Helm chart deploys the **same Docker image** built with cluster-correct URLs at CI time. Single-env-per-deploy keeps the constraint workable.

## Alternatives considered

### Remix (now React Router 7 "framework mode") — rejected

- Strong data-loader story; nested routing.
- Smaller ecosystem of pre-built integrations (less third-party Storybook / TanStack Query / next-auth tooling assumes Next.js).
- The team had more cumulative hours in Next.js than in Remix at decision time.
- Server Functions / Actions are a recent addition; not yet as battle-tested as Next.js's RSC + Server Actions.

### SvelteKit — rejected

- Smaller bundle sizes; great DX.
- Team unfamiliarity. Hiring/teaching cost outside the project budget.
- TanStack Query + Zustand patterns are React-shaped — re-doing them in Svelte stores would be wasted effort.

### Plain React + Vite (no SSR) — rejected

- Faster local dev cycle.
- **SSR is mandated by the milestones doc** (M2.5 — "Next.js App Router, Server Components, SSR/SSG/ISR"). A CSR-only SPA would fail the deliverable.

### Next.js Pages Router — rejected (within Next.js)

- App Router is the stated requirement (M2.5) and is now the recommended default for new Next.js projects. Pages Router is supported but maintenance-mode.
