# ADR-0008: TanStack Query v5 over SWR / RTK Query

- **Status:** Accepted (M2.4 / M2.5, 2026-Q1)
- **Deciders:** Full Team
- **Reflected in:** [`containers.md`](../containers.md), `frontend/CLAUDE.md`

## Context

M2.4 + M2.5 mandate **TanStack Query + Zustand or Redux** for state. The milestones doc explicitly names TanStack Query — but we still need to write down *why* over the obvious alternatives, because the choice constrains:

- How server state is cached, refetched, and invalidated.
- How SignalR notifications (when wired up) plug back into the UI — the answer is `queryClient.invalidateQueries(...)`, not "store the push payload as canonical state".
- How mutations interact with optimistic updates.
- Whether we need Redux at all (we do not — Zustand carries the small amount of client-only state).

## Decision

Adopt **`@tanstack/react-query` v5** for **all** server state. **Zustand v5** carries the small amount of client-only state that doesn't belong in URL params, form state, or React local state (e.g., the decoded JWT subject + roles in `useAuthStore`).

- Query keys live in a centralised, hierarchical tree (`lib/hooks/queryKeys.ts`):
  `queryKeys.tenant.{account, lease, payment.{current, history}}` and `queryKeys.landlord.{dashboard, payment.upcoming}`.
- ~20 typed hooks in `lib/hooks/` wrap `useQuery` / `useMutation` with the centralised Axios client (Keycloak-bearer-injected) from `lib/api/client.ts`.
- Devtools mounted in dev via `@tanstack/react-query-devtools`.

## Consequences

### Positive

- **Full mutation lifecycle** — `useMutation` exposes `onMutate` / `onSuccess` / `onError` / `onSettled`. We rely on `onSuccess` for `invalidateQueries` (the canonical refresh strategy) and `onMutate` for optimistic UI.
- **Devtools** that show every active query, its cache state, last-fetched timestamp, and the data on disk. Saved hours in M2/M3 debugging.
- **No Redux ceremony.** Server state in TanStack, client state in Zustand. The boilerplate-tax of Redux is avoided where it's not needed.
- **SignalR integration** is mechanical: a `signalr.on("PaymentConfirmed", ...)` handler calls `queryClient.invalidateQueries(queryKeys.tenant.payment.current)` and the UI refetches. **The push delivers a signal, never canonical state.**
- **`queryKey` hierarchy** lets a coarse invalidation (e.g., `['tenant']`) cascade to every leaf — useful when the user role transitions (post-invite acceptance) and *everything* needs refetching.

### Negative

- **Cache lifetime tuning** is a real concern. Stale times set per-query; aggressive defaults can hide stale data, conservative defaults waste bandwidth. M2/M3 settled on 30 s as the default; dashboard queries use 60 s aligned with the backend Redis cache TTL.
- **TanStack v5 is a major version**; some patterns from v4 (e.g., `keepPreviousData`) moved to `placeholderData: keepPreviousData`. M2 onboarding caught this.
- **Devtools bundle size** is non-trivial; gated to dev builds only.

### Mitigations

- Centralised query keys + hooks mean every consumer reuses the same staleTime / refetchOnWindowFocus settings — no scattered config.
- `frontend/CLAUDE.md` documents the project's TanStack patterns including the SignalR-invalidates-cache contract.

## Alternatives considered

### SWR — rejected

- Smaller, simpler API. Lacks the full mutation lifecycle TanStack provides.
- No equivalent of TanStack's queryKey hierarchy for cascading invalidation.
- Devtools exist but are less feature-rich.

### Redux Toolkit Query (RTK Query) — rejected

- **Couples us to Redux.** We'd need a Redux store for *only* server state, then bolt Zustand on for client state — two stores. Or move all client state to Redux, paying for a heavyweight library we don't otherwise want.
- RTK Query's auto-generated hooks are nice, but the endpoint definition API is more verbose than TanStack's `useQuery`.

### Apollo Client — rejected

- We don't use GraphQL.

### Plain `fetch` + `useEffect` — rejected

- Re-implementing: caching, refetching, retry, deduplication, mutation lifecycle, devtools, optimistic updates, cross-tab refetch, window-focus refetch.
- This is what TanStack Query exists to remove.
