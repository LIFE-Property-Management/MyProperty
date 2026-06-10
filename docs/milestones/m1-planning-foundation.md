# Milestone 1 — Research, Planning & Foundation

**Status:** ✅ Complete
**Window:** Late March – mid-April 2026 (project inception → first frontend scaffold)
**Aligns with:** Project inception — the problem definition, market research, tooling, and repository foundation that every build milestone (M2 onward) stands on.

> **Reconstructed record.** M1 predates the per-milestone documentation convention, so this
> file was written after the fact (2026-06-10) from two contemporaneous sources: the **M1 AI
> log** ([`../logs/m1-ai-logs.md`](../logs/m1-ai-logs.md) — 14 dated entries, 23 Mar – 6 Apr) and
> the **earliest git history** (`314303f` "Starter structure initialization" → `1ce95cf` "Added
> M1 AI logs" → `f3fc7cd` "starter front-end architecture", the commit that opens M2). The
> decisions below are real and shipped; the deliverable framing is inferred from that evidence,
> not copied from a contemporaneous M1 plan.

## What M1 was

M1 produced **no application code** — it is the foundation milestone. Its output is the set of
product decisions, the tooling, and the repository scaffold that everything after it depends on.
The two questions M1 answered were: *who is this for and why would they switch to us?* and *what
do we build it with, and how do we work?*

## Deliverables

| ID | Deliverable | Description |
|---|---|---|
| M1.1 | Market & competitor research | Surveyed the property-management tools active in the Balkans (Rentigo, Bidrento, Renflow, others) — features, positioning, gaps. |
| M1.2 | Problem definition & target user | Settled the wedge: the **lone Balkan landlord**, underserved by enterprise tools. Needs identified — local/cash + digital payments, utility tracking, multilingual comms, simple owner reporting, fast onboarding. |
| M1.3 | Technology-stack selection | Front end (React/Next.js), state split (Zustand + TanStack Query), and the eventual backend/IdP shape decided in principle. |
| M1.4 | Project-management setup | Linear chosen and configured (cycles, story points) for a 3-person team. |
| M1.5 | Repository & Git workflow | `develop`/`main` branches with branch **rulesets**; repo skeleton + folder scaffold initialised. |
| M1.6 | Core flow design | The tenant-invitation lifecycle designed as a single token-based flow (the spine of the later M2/M3 invite feature). |
| M1.7 | Design & prototyping tooling | Figma retained after evaluating alternatives. |
| M1.8 | AI usage log #1 | [`../logs/m1-ai-logs.md`](../logs/m1-ai-logs.md) — 14 entries documenting the research and tooling decisions. |

## Decisions

Every M1 decision is recorded here with the reason it was made, not just the outcome.

- **Target the lone Balkan landlord, not enterprise parity.** Competitor analysis (M1.1) showed the
  market is served by feature-heavy tools built for agencies. The opening is the opposite: a
  *simple, fast-onboarding* tool for an individual landlord, with local-payment reality (cash is
  still large in the region) and multilingual communication as differentiators rather than a long
  enterprise feature list. This framing is what makes "active leases under management" the right
  North Star later (M6.2) — value is one landlord successfully managing one tenant, not breadth.

- **Linear over Jira / Notion for project management.** For a 3-person team, Jira's process weight
  only pays off at scale, and Notion is a document tool pressed into tracking. Linear's cycle model
  fits short iterations with the least ceremony. *(AI log entries 5, 10.)*

- **Zustand + TanStack Query over Redux.** Decided up front to **separate server state from client
  state**: TanStack Query owns the server cache (the thing SignalR would later invalidate), Zustand
  owns the small client/auth slice. Redux's boilerplate only earns its keep with many developers on
  a large shared store — not here. This split is still the frontend's architecture today.
  *(AI log entry 12; carried into M2 and recorded in `frontend/CLAUDE.md`.)*

- **Token-based, single-flow tenant invitation.** Rather than branching the invite logic on whether
  the invitee already has an account, the flow was designed around a **single cryptographic token
  as the source of truth**, with the invite modelled as a state machine (Pending → Accepted /
  Rejected / Expired). Fewer branches, fewer bugs, and it scales to the "log in then accept" case
  without a separate path. This is exactly the model M3 shipped. *(AI log entry 9.)*

- **`develop` / `main` with branch rulesets.** `develop` is the fast-iteration branch (breakage is
  tolerable); `main` is only merged into when the team is confident. Branch **rulesets** were chosen
  over classic branch-protection rules, configured minimally and tightened later as CI status checks
  came online — start simple, don't over-protect early. *(AI log entries 6, 7.)*

- **Figma retained for design.** Alternatives were evaluated honestly (Framer is stronger for
  interactive prototyping; Adobe XD is effectively discontinued and was ruled out), but Figma won on
  ecosystem maturity and team familiarity. *(AI log entry 11.)*

- **AI logs as Markdown in the repo, not a Google Doc.** Version-controlled alongside the code, no
  login friction, diff-able — standard practice. Set the `docs/logs/mN-ai-logs.md` convention used by
  every milestone since. *(AI log entry 13.)*

## Progress Log

Reconstructed from the AI-log dates and the earliest commits.

### Late March 2026 — research & positioning
- Competitor survey of Balkan property-management software; market-gap analysis pointing at the
  lone-landlord wedge (M1.1, M1.2).
- Process groundwork: story-point sizing convention agreed; Linear set up with cycles (M1.4).

### Early April 2026 — tooling, workflow & core design
- Git workflow established — `develop`/`main` with rulesets; an early force-push history mishap
  resolved before it could compound (M1.5).
- Repository skeleton committed (`314303f` "Starter structure initialization").
- Core architecture decisions taken: Zustand + TanStack Query state split (M1.3); token-based invite
  flow designed (M1.6); Figma retained (M1.7).
- M1 AI log committed (`1ce95cf`); the AI-log-as-Markdown convention set (M1.8).

### Transition to M2
- `f3fc7cd` "starter front-end architecture" opens the M2 frontend build on top of the M1 decisions.

## Deliverable Status

| ID | Status | Notes |
|---|---|---|
| M1.1 | ✅ done | Competitor survey + market-gap analysis (AI log entries 1–2). |
| M1.2 | ✅ done | Lone-Balkan-landlord wedge + the needs list that shaped the product. |
| M1.3 | ✅ done | Front-end stack + Zustand/TanStack-Query split decided; carried into M2. |
| M1.4 | ✅ done | Linear with cycles + story points. |
| M1.5 | ✅ done | `develop`/`main` + rulesets; repo scaffold committed. |
| M1.6 | ✅ done | Token-based invite lifecycle design; implemented in M3. |
| M1.7 | ✅ done | Figma retained after alternatives review. |
| M1.8 | ✅ done | [`../logs/m1-ai-logs.md`](../logs/m1-ai-logs.md). |

## Known Gaps at M1 close (carried into M2)

- **No code yet.** M1 is decisions + scaffold only; the first real UI lands in M2.
- **Backend / IdP shape decided only in principle.** The concrete .NET Clean-Architecture +
  Keycloak choices are recorded against M3 (and in the [ADRs](../architecture/adr/)), not here.
- **Designs not committed to the repo.** Figma artifacts live in Figma, not version-controlled.
