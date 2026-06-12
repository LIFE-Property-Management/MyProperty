# MyProperty — Milestones

Index of milestone records. Each milestone has its own file: completed milestones are frozen historical records; the active milestone is updated as work progresses.

## Status overview

| Milestone | Window | Status | File |
|---|---|---|---|
| M1 — Research, Planning & Foundation | Late Mar – mid-Apr 2026 | ✅ Complete | [`m1-planning-foundation.md`](./m1-planning-foundation.md) |
| M2 — Frontend MVP | through April 17, 2026 | ✅ Complete (with documented debt) | [`m2-frontend-mvp.md`](./m2-frontend-mvp.md) |
| M3 — Backend MVP | April 23 – May 8, 2026 | ✅ Complete | [`m3-backend-mvp.md`](./m3-backend-mvp.md) |
| M4 — Deployment & Operations | May 13 – May 25, 2026 | ✅ Complete | [`m4-deployment-ops.md`](./m4-deployment-ops.md) |
| M5 — End-to-end Auth & Authorization | May 2026 – | 🟡 In progress (local complete; cluster deploy deferred) | [`m5-auth-end-to-end.md`](./m5-auth-end-to-end.md) |
| M6 — Product Analytics & Experimentation | June 2026 – | 🟡 In progress (M6.1 analytics + M6.2 North Star done) | [`m6-product-analytics.md`](./m6-product-analytics.md) |

## Conventions

- Completed milestone files are **frozen** once the milestone closes. New work goes in the active milestone file. Errata or post-hoc corrections to closed milestones are added in a clearly marked "Errata" section, not by editing the original log.
- Each milestone file has the same top-level structure: Deliverables → Technical Requirements → Decisions → Progress Log → Deliverable Status → (closed milestones only) Known Gaps.
- "Known Gaps" sections in closed milestones are historical — they document debt that was accepted at close. The active milestone's "Inherited debt" section tracks what's actually being resolved.
## Related docs

- [`../portals.md`](../portals.md) — portal feature specs
- [`../audits/`](../audits/) — codebase audit reports
- [`../performance/`](../performance/) — Lighthouse + bundle analysis artifacts

## Cross-cutting features

- **Invites** (landlord create/manage → invitee accept/claim → lease + tenant cancel) — completed across a
  6-plan effort spanning the M5/M6 window. Full feature state, live e2e results, deviations, and remaining
  deferred items are recorded in `INVITES-FEATURE-CLOSEOUT.md` (repo root). Notable deferred follow-ups:
  single-active-lease-per-tenant invariant, one-pending-invite-per-property guard, tenant payment wiring,
  and the Keycloak silent check-sso prod bug (see memory / closeout).
