# MyProperty — CLAUDE.md

## Stack
Next.js App Router · TypeScript strict (no any) · Tailwind CSS · TanStack Query (all server state) · Zustand (client state) · React Hook Form + Zod

## Design System

### Colors
| Token | Light | Dark |
|---|---|---|
| Background | `#fbfbff` | `#0d1117` |
| Surface | `#ffffff` | `#161b22` |
| Border | `#e5e7eb` | `#30363d` |
| Primary | `#275D2C` | `#3fb950` |
| Primary text | `#111111` | `#f0f6fc` |
| Muted text | `#4b5563` | `#8b949e` |
| Error / Danger | `#931F1D` | `#f85149` |

**⚠️ Never use red (`#931F1D`) as a brand or accent color. Red is strictly for error/danger states only.**

### Typography
- Headings: **Playfair Display**
- Body/UI: **DM Sans**

## Styling Rules
- **Mobile-first.** Three breakpoints only: base (mobile), `md` (768px), `lg` (1024px). Do not use `sm`, `xl`, `2xl`.
- Dark mode via prefers-color-scheme media query, handled in globals.css — color tokens auto-flip. Do not add dark: variants in component code; tokens are already dark-mode-aware. No class-based toggle.
- Use exact color tokens above. Do not invent new dark mode colors.
- Hover: brand-green hover (hover:bg-primary etc.) only on primary/confirming actions. Chrome (sidebars, menus, secondary buttons) uses hover:bg-neutral-light.
- Focus rings: use focus-visible: not focus:.
- No motion library. The only blessed motion class is transition-colors duration-150.
- <body> sets font-family: var(--font-sans) and h1...h6 use var(--font-heading) automatically (in globals.css). Do not add redundant font classes to headings or body. DO add font-heading to spans that need the heading font (e.g. brand text in headers

## Color token semantics
- `*-light` (e.g. `primary-light`, `danger-light`): tinted background fill,
  designed to pair with the strong color (e.g. `bg-primary-light text-primary`).
  Does NOT literally mean "a lighter shade." Values are tuned per mode for
  contrast — pale in light mode, deep-tinted in dark mode.
- `*-dark` (e.g. `primary-dark`): the hover/pressed state for the strong color.
  In light mode this is darker than the base; in dark mode it's brighter.
  Use it for interactive states, not as a "darker shade" primitive.

## Color token semantics
- `*-light` (e.g. `primary-light`, `danger-light`): tinted background fill,
  designed to pair with the strong color (e.g. `bg-primary-light text-primary`).
  Does NOT literally mean "a lighter shade." Values are tuned per mode for
  contrast — pale in light mode, deep-tinted in dark mode.
- `*-dark` (e.g. `primary-dark`): the hover/pressed state for the strong color.
  In light mode this is darker than the base; in dark mode it's brighter.
  Use it for interactive states, not as a "darker shade" primitive.

## Coding Rules
- TypeScript strict — no `any` without justification.
- All data fetching via **TanStack Query** — no raw `fetch` or `useEffect`-based fetching.
- Keep Landlord and Tenant portal code **strictly separated** — do not mix concerns.
- Tenant names are **always a `<Link>`** to the Tenant Detail page, everywhere they appear (tables, cards, logs).

## Auth
- Keycloak handles auth. All authenticated requests: Authorization: Bearer <token>.
- Three roles: Tenant, Landlord, Admin. Auth state lives in shared useAuthStore; consume via the useAuth() hook.
- Role-specific domain state (e.g. tenantAccountStatus) is fetched from /me, not stored in the JWT.
- Tenants cannot self-register — landlords invite via email only.
- Lease acceptance screen comes before account creation/password setup.

## Testing
- Jest + React Testing Library. Jest resolves @/ alias via moduleNameMapper in jest.config.mjs.
- Use fireEvent, not userEvent.
- Tests import the component-under-test via relative path; shared utilities and types via @/.
- Mirror existing mock patterns (see Batch L1 / L2 tests for reference).

## API
- REST via `NEXT_PUBLIC_API_BASE_URL`. Whether calls are direct or proxied via Route Handlers is TBD — do not hardcode either pattern.

## Real-time (SignalR)
- Backend exposes a `NotificationsHub` at `/hubs/notifications`. Frontend connects via `@microsoft/signalr` with the JWT bearer token (passed as `?access_token=` for the WebSocket handshake).
- Server pushes events for payment + invite state changes; the client uses these as **signals only**, not as data.
- On every received event, the client calls `queryClient.invalidateQueries([...])` for the relevant query key. TanStack Query refetches authoritative data from the API.
- **TanStack Query remains the source of truth.** Do not store SignalR payloads as canonical state. Do not bypass the API to read pushed payloads as data.
- Connection management: one hub connection per authenticated session, lifecycle owned by a top-level provider (`SignalRProvider`). Auto-reconnect enabled with `withAutomaticReconnect()`.

## Key Omissions (intentional)
- **v0.dev: opted out.** Do not suggest it.

## Further Specs
- Portal features & flows: `docs/portals.md`
- Milestones & deliverables: docs/m3-backend-mvp.md (active), docs/m2-frontend-mvp.md (closed)