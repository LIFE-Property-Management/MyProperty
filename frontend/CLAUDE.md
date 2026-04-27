# MyProperty — CLAUDE.md

## Stack
Next.js App Router · TypeScript strict (no `any`) · Tailwind CSS · TanStack Query (all server state) · Zustand (client state) · React Hook Form + Zod · Framer Motion

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
- Dark mode via `prefers-color-scheme` media query — use Tailwind `dark:` variant. No class-based toggle.
- Use exact color tokens above. Do not invent new dark mode colors.

## Coding Rules
- TypeScript strict — no `any` without justification.
- All data fetching via **TanStack Query** — no raw `fetch` or `useEffect`-based fetching.
- Keep Landlord and Tenant portal code **strictly separated** — do not mix concerns.
- Tenant names are **always a `<Link>`** to the Tenant Detail page, everywhere they appear (tables, cards, logs).

## Auth
- Keycloak handles auth. All authenticated requests: `Authorization: Bearer <token>`.
- Tenants cannot self-register — landlords invite via email only.
- Lease acceptance screen comes **before** account creation/password setup.

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
- Milestones & deliverables: `docs/milestones.md`