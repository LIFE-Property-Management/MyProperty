# Milestone 6 AI Logs — Final (Cumulative)

## Summary

This is **AI Log Entry #6**, the final entry in the series, and it does double duty
(deliverable **M6.7**):

1. **Part 1** records the AI usage during Milestone 6 itself (product analytics &
   experimentation), in the same per-conversation format as the earlier logs.
2. **Part 2** rolls the whole project up into **summary statistics** across all six
   milestones.
3. **Part 3** is the **reflection / retrospective** — what worked, what didn't, the
   recurring lessons, and how the way we used AI changed from M1 to M6.

The five prior logs are the source material for Parts 2 and 3:

| Log | Milestone | File |
|---|---|---|
| #1 | Product Foundation | [`m1-ai-logs.md`](./m1-ai-logs.md) |
| #2 | Frontend MVP | [`m2-ai-logs.md`](./m2-ai-logs.md) |
| #3 | Backend MVP | [`m3-ai-logs.md`](./m3-ai-logs.md) |
| #4 | Infrastructure & DevOps | [`m4-ai-logs.md`](./m4-ai-logs.md) |
| #5 | Fullstack Integration & Hardening | [`m5-ai-logs.md`](./m5-ai-logs.md) |
| #6 | Product Analytics & Experimentation | **this file** |

---

# Part 1 — Milestone 6 entries

> ⚠️ **Verification note.** Entries 1–4 below are **drafts reconstructed from the
> committed M6 deliverables** (`docs/milestones/m6-product-analytics.md` — which now also
> contains the North Star section — and `docs/operations/admin-dashboard.md`) and
> the PR history. The *decisions* they describe are real and shipped; the **prompt
> wording, exact dates, and time-saved figures are placeholders** — replace them with
> the details from your actual conversations before this log is considered final.
> Entry 5 (compiling this log) is a true record of the session that produced this file.

M6 was the analytics & experimentation milestone. The shipped deliverables were
**M6.1** (PostHog analytics + funnels), **M6.2** (North Star Metric), and **M6.3**
(admin/stakeholder KPI dashboard). AI was used the same way it was by M5: tool-choice
support, abstraction design, and defending a product decision rather than just asserting
it.

---

### Entry 1 — Analytics tool selection: PostHog vs GA4 (M6.1)

**Date:** _[verify — around the M6.1 PR, #159]_

**Tool used:** Claude — compared PostHog and GA4 for the analytics deliverable, with the
candidate trade-offs surfaced as an explicit choice rather than a single recommendation.

**Prompt / input:**
> _[verify wording]_ The M6.1 brief says "GA4 or PostHog." We self-host most of the stack
> (Keycloak, Grafana, Loki, RabbitMQ) and M6.4 needs an A/B test. Which fits, and why —
> don't just pick one, lay out the trade-offs.

**Output quality:** The comparison that landed in `m6-product-analytics.md` came out of
this — the funnels/paths/retention vs marketing-oriented split, experiments built-in
(matters for M6.4) vs needing extra tooling, EU-cloud/self-host data residency for tenant
PII vs Google-hosted GDPR friction, and cost. The verdict (PostHog, EU cloud) was
defensible because it was anchored to *our* specifics — a B2B SaaS whose core artifact is
a conversion funnel and whose next milestone is an A/B test — not a generic feature
table. This followed the standing rule from M5.1: ask for the trade-offs in each candidate
before committing, never accept a blind "use X."

**Time saved estimate:** _[verify]_ ~30–45 minutes of cross-referencing two product docs
and pricing pages, and — more importantly — not picking the wrong tool blind right before
the experimentation milestone.

**Lessons learned:** The deciding factor for a tooling choice is almost always a project
constraint the generic comparison can't know (here: self-hosting ethos + an A/B test one
milestone away). Putting those constraints in the prompt is what turns a feature table
into a decision. _Recurring theme — see M1.10/M1.11 (PM & prototyping tools), M5.1
(diagram tooling), M5.6 (feature-flag tool)._

---

### Entry 2 — Analytics architecture: no-op facade + typed event taxonomy (M6.1)

**Date:** _[verify — M6.1 build-out, PR #159]_

**Tool used:** Claude — designed the analytics integration so the SDK stays isolated and
the whole thing is a clean no-op when unconfigured.

**Prompt / input:**
> _[verify wording]_ Wire PostHog into the Next.js frontend, but mirror the existing
> `WebVitalsReporter` pattern: env-driven, no-op without a key, and `posthog-js` imported
> in exactly one module. Events must be typed so adding one without a payload contract is
> a compile error. Identity centralized so both portals are covered without touching
> `KeycloakInit`.

**Output quality:** The shape that shipped: `lib/analytics/{events,posthog,index}.ts` with
`posthog.ts` as the only importer of `posthog-js`; a `capture()` whose event name
constrains its payload via `AnalyticsEventProperties` (variadic-tuple signature — paramless
events take no second arg, payload events require one); `AnalyticsProvider` at the root
layout handling init, manual `$pageview` on App Router navigation, and identify-on-login /
reset-on-logout keyed by the Keycloak `sub`. `person_profiles: "identified_only"` for a
lighter GDPR footprint. The no-op-without-key design means tests, CI, and security scans
all run with analytics cleanly off and no secret is committed — the two `NEXT_PUBLIC_*`
vars are deliberately **kept out of `requirePublicEnv()`** so a missing key never fails the
build. 11-event taxonomy across both portals; full suite stayed green (473 tests).

**Time saved estimate:** _[verify]_ ~1 hour. Anchoring the design to an existing pattern
(`WebVitalsReporter`, `NullEventPublisher`) is what made it consistent on the first pass
rather than a bespoke integration.

**Lessons learned:** "Mirror the pattern already in the codebase" is a higher-quality
instruction than "implement X." It produces an integration that looks like it belongs. The
typed-event-or-compile-error constraint is the kind of guardrail worth stating up front —
it's free once designed in and impossible to bolt on later. _Same SDK-isolation principle
as M5.6's `IFeatureFlags` and M3's `IEventPublisher`._

---

### Entry 3 — North Star Metric: definition & defence (M6.2)

**Date:** 2026-06-07 _(per the North Star section of `m6-product-analytics.md`)_

**Tool used:** Claude — pressure-tested the North Star candidate and argued down the
alternatives instead of just declaring one.

**Prompt / input:**
> _[verify wording]_ Help me pick and *defend* a North Star Metric for MyProperty. I don't
> want a vanity number — I want the smallest unit of real delivered value, and I want every
> obvious alternative explicitly rejected with a reason.

**Output quality:** The metric that landed — **Active Leases Under Management**
(`Status = Active AND DeletedAt IS NULL`) — is defensible precisely because the alternatives
were dismantled, not ignored: signups and invites-sent are upstream activity not outcome,
rent collected and MRR are lagging (30-day cycle), total users mixes two engagement
patterns, and DAU misleads for an inherently low-frequency product. The clinching argument
is the chain in the doc: *one active lease requires the entire product to work* (landlord
signs up → creates property → sends invite → tenant accepts + account created → lease row),
so the count doubles as an end-to-end health check. It's tracked three ways — per-landlord
dashboard stat card, a platform-wide Prometheus gauge (`myproperty_active_leases_total`,
the M6.2 `NorthStarMetricWorker`), and the DB as source of truth.

**Time saved estimate:** _[verify]_ ~45 minutes. Writing a metric defence that argues the
edge cases (why *not* MRR, why *not* DAU) is the difference between a real choice and a
checkbox — and that's the part that's slow to write tightly.

**Lessons learned:** A North Star claim is only worth something if you name the tempting
alternatives and explain why each is upstream, lagging, or a vanity proxy. "Defend it,
don't just state it" is the same instruction that made the M5.3 3NF review and the M5.4
audit credible.

---

### Entry 4 — Admin / stakeholder KPI dashboard (M6.3)

**Date:** _[verify — admin dashboard PR, #161]_

**Tool used:** Claude — selected the KPIs for a non-technical audience and caught the
correctness traps in aggregating them.

**Prompt / input:**
> _[verify wording]_ Design the admin/stakeholder dashboard: platform-wide business KPIs
> for a product-lead (non-technical) audience, served from one cached endpoint. Tell me
> which numbers actually matter and where the aggregation can go wrong.

**Output quality:** The KPI set in `admin-dashboard.md` — growth & users, adoption &
occupancy, the invite funnel (sent/accepted/rejected/expired/pending + acceptance rate),
financials, and a small system-health line — is shaped for a non-technical reader (rates
and trends, not raw rows). The two correctness calls are the valuable part: **financial
totals are grouped by currency and never summed across currencies** (summing EUR + a second
currency into one number would be silently wrong), and **all 12-month trend series are
gap-filled to explicit zeros** so charts don't drop empty months. The endpoint is
Redis-cached (5-min TTL) and gated by the `RequireAdmin` policy, with the
single-portal-role constraint (an admin holds *only* `Admin`, never also Landlord/Tenant).

**Time saved estimate:** _[verify]_ ~45 minutes — and a correctness save: the
never-sum-across-currencies rule is exactly the kind of thing that ships as a plausible
wrong number if nobody flags it.

**Lessons learned:** For a stakeholder dashboard the hard part isn't the query, it's
choosing numbers a non-technical reader can act on and not mixing units (currencies,
gap-filled time buckets) into a misleading aggregate. _Same "verify the aggregate is
actually correct" instinct as M5.4/M5.5._

---

### Entry 5 — Compiling this cumulative AI log (M6.7)

**Date:** 2026-06-08

**Tool used:** Claude Code (Opus 4.8, 1M context) — read all five prior logs and the M6
milestone docs, computed the summary statistics, and synthesised this final entry.

**Prompt / input:**
> Help me implement deliverable M6.7: the complete, cumulative AI development log with
> summary statistics and reflections.

**Output quality:** Claude Code read the five existing logs end-to-end
(`m1`–`m5-ai-logs.md`), the M6 deliverable docs, and the git history to confirm what
actually shipped in M6 before writing anything. It surfaced a real scope decision up front
— whether the final log should be a pure cumulative roll-up or also close the per-milestone
series with M6 entries — and **refused to fabricate** prompts/dates for the M6
conversations it wasn't part of, drafting Entries 1–4 from the committed deliverables and
marking them for verification instead. The entry counts (84 across M1–M5) and per-milestone
time-saved subtotals in Part 2 were computed directly from the files, not estimated.

**Time saved estimate:** ~2–3 hours. Manually re-reading ~85 entries across five files,
tallying counts and time-saved ranges, and writing a coherent retrospective would have been
most of a day; the statistics tables alone are tedious to assemble by hand.

**Lessons learned:** Even for a "just write the doc" task, having the model read the source
material and confirm against git before drafting prevented both an inaccurate roll-up and
the temptation to invent M6 conversations to fill the template. The honesty constraint —
"don't log a conversation that didn't happen" — is what keeps the whole log credible; a
single fabricated entry would undermine the other 88.

---

# Part 2 — Cumulative summary statistics

> **Methodology.** Entry counts are exact (one `### Entry` heading and one "Time saved"
> line per entry, counted from the files). Time-saved figures are **self-reported
> estimates**; where an entry gave a range (e.g. "1–2h") the midpoint was used, and the
> totals are rounded. They measure *estimated effort avoided*, not wall-clock or a
> controlled measurement — treat them as order-of-magnitude, not precise.

## Entries & estimated time saved, by milestone

| # | Milestone | Theme | Entries | Est. time saved |
|---|---|---|---|---|
| M1 | Product Foundation | Research, PM tooling, product framing | 14 | ~15.5 h |
| M2 | Frontend MVP | Plan → execute → review pipeline, Tenant Portal | 39 | ~26.5 h |
| M3 | Backend MVP | API gen, query optimisation, debugging, security | 14 | ~29 h |
| M4 | Infrastructure & DevOps | Audit→plan, scope calls, PR review, CVE triage | 9 | ~7.5 h |
| M5 | Integration & Hardening | Architecture decisions, deep debugging, review | 8 | ~6.5 h |
| M6 | Product Analytics | Tool choice, metric defence, this log | 5 | _[verify]_ |
| | | **Total (M1–M5)** | **84** | **~85 h** |
| | | **Total (incl. M6)** | **89** | **~85 h+** |

The shape is informative: **M2 has the most entries (39)** because that's where the
plan → execute → review pipeline was discovered and every step got logged, but **M3 saved
the most time (~29 h)** because backend scaffolding, repetitive handler structure, and
non-obvious footguns (RabbitMQ v7 API, Keycloak claim mapping) are where AI leverage is
highest per conversation. By M4–M5 the entry count drops and the *per-entry value rises* —
fewer, higher-stakes conversations (a CVE-reachability triage, an architecture pivot, a
catch of a stale audit finding).

## By tool

| Tool | ~Entries | Primary use |
|---|---|---|
| **Claude** (chat — Sonnet/Opus) | ~50 | Consultation, planning prompts, code & PR review |
| **Claude Code** (Sonnet 4.6 / Opus 4.7 / Opus 4.8) | ~25 | Implementation, in-repo planning, this log |
| **ChatGPT** | ~10 | Early research & one-off explanations (most of M1; one M3 Docker fix) |
| **Anthropic Console** | a few | Iterating planning prompts (M3) |

Roughly **74 of 84 logged entries used a Claude-family model**; ChatGPT carried the early
product-research phase (M1) and a single Testcontainers fix in M3, after which the project
standardised on Claude. (Many M2/M3 entries used *more than one* tool in a single workflow —
Opus to plan, Claude Code to execute, Claude to review — so per-tool counts overlap.)

## By interaction type (approximate; many entries span more than one)

| Mode | ~Entries | Where it shows up |
|---|---|---|
| Consultation / concept explanation | ~22 | M1 throughout; M2 Zustand/auth; "explain X before I touch code" |
| Code / PR / artifact review | ~18 | M2 file-by-file reviews; M4 & M5 PR reviews; audit/doc review |
| Planning & scope decisions | ~16 | Opus planning prompts (M2/M3); M4 audit→plan, CI scope |
| Debugging & triage | ~14 | M3 RabbitMQ/layering/Testcontainers; M4 healthcheck/SHA/CVE; M5 issuer/Unleash |
| Implementation (Claude Code) | ~9 | M2 Tenant Portal phases; M3 handlers/SignalR/RabbitMQ |
| Tooling & architecture decisions | ~5 | M1 PM & prototyping tools; M5 diagram & feature-flag tool; M6 PostHog |

## Headline numbers

- **89 logged AI conversations** across ~2.5 months (late March → early June 2026).
- **~85 hours of self-estimated effort avoided** (M1–M5; M6 figures pending verification).
- **6 milestones**, every one with AI woven through planning, building, debugging, and review.
- **3-model handoff pipeline** (Opus plans → Claude Code executes → Claude reviews) became
  the default working method from M2 onward.

---

# Part 3 — Reflections & retrospective

## How our use of AI evolved

**M1 — AI as a search engine that talks back.** Almost everything was ChatGPT, one-shot:
competitor research, "what are story points," "Axios interceptors — what is this?" The
prompts were short and sometimes too vague (Entry 1 was flagged in its own log as "a bit
too vague"). Value was real but shallow — minutes-to-an-hour of reading saved per question.

**M2 — the pipeline appears.** The single biggest method change in the whole project
happened here: **Opus plans → Claude Code executes → Claude reviews, file by file.** The
Tenant Portal was built this way, and the logs show the discipline forming — planning
prompts that "leave nothing to infer," reviewing each generated file against the plan, using
screenshots as a visual spec instead of prose. This is also where AI *errors* start getting
caught and logged honestly (a wrong CSS `@import` order it suggested; named-import-for-
default-export bugs Opus repeatedly introduced).

**M3 — the pipeline matures and gets guardrails.** Planning prompts now carry `CLAUDE.md`
and explicit edge cases (resubmission state, cache-invalidation triggers). `TreatWarningsAsErrors`
becomes "the second reviewer that catches everything Claude Code missed." The log is even
*structured by audit area* (API gen / query opt / debugging / security) so coverage is
provable. AI is used to read `EXPLAIN ANALYZE` output and to reason about *why* a partial
index beats a full one — not just to generate code.

**M4 — judgment, not just generation.** The high-value conversations stop being "write this"
and become "decide this": converting a 9-item audit into an ordered execution plan, deciding
"what's a credible CI story vs theatre," and triaging a CRITICAL CVE by asking *is it even
reachable in our deployment topology* (it wasn't — 32-bit-only on amd64 nodes). PR review
shifts to **read the description first, before any files** — and that alone caught a feature
(prompt caching) that was claimed but never actually verified.

**M5 — AI as a design partner that can be wrong.** Architecture pivots (the operator-based
monitoring chart that *structurally cannot* install under a namespace-scoped ServiceAccount),
deep single-bug debugging (the Authority-vs-issuer mismatch that rejected every login), and
review work that explicitly **resists a tempting wrong instinct** ("a kill-switch should fail
*closed*" — actually wrong here, and Claude reasoned out why).

**M6 — back to product thinking.** Tool selection with the trade-offs laid out (PostHog vs
GA4), an SDK-isolated analytics facade that mirrors existing patterns, and *defending* a
North Star Metric by dismantling the alternatives.

## What worked

- **Specificity beats everything.** The first-try successes correlate almost perfectly with
  prompts that pasted the real artifact: exact error strings + the config block (M5 issuer
  bug), before/after `EXPLAIN` output (M3), `CLAUDE.md` + the spec (most planning prompts),
  screenshots (M2 visual spec). Vague prompts produced vague output; concrete inputs produced
  first-try answers.
- **The plan → review-the-plan → execute → review-the-output loop.** A second AI pass over a
  *plan* repeatedly caught bugs before they became code (M2/M3 named-import bugs, a
  TenantAccountStatus enum mismatch). Cheaper than catching them at the TSC checkpoint, far
  cheaper than at runtime.
- **"Mirror the existing pattern."** Anchoring new work to something already in the repo
  (`WebVitalsReporter` → analytics facade, `NullEventPublisher` → `NullFeatureFlags`,
  `IBackgroundJobQueue` → `INotificationDispatcher`) produced consistent code on the first
  pass and kept the layering rules intact.
- **Description-first PR review.** Reading what a PR *claims* before opening a file surfaced
  inconsistencies (a test-count regression, an unverified caching feature, a fail-open
  default that needed confirming not "fixing") faster than file-by-file reading would.
- **"Verify the claim against the code, don't just read it."** The single most valuable
  review instruction — it caught a stale audit finding (M5.4) that had been copied verbatim
  from an outdated README and was simply no longer true.

## What didn't (and the honest limits)

- **Context is lost across handoffs.** A constraint Claude *flagged during planning* (dynamic
  `process.env` access defeats Next.js static inlining) was lost when the plan went to Claude
  Code in a fresh context, and the bug shipped to the bundle-verification step (M4.2). Fix:
  carry planning constraints explicitly into the execution prompt — the executor didn't have
  the planning conversation.
- **AI is confidently wrong sometimes, and the safe-sounding answer can be the wrong one.**
  It suggested *weakening* `TreatWarningsAsErrors` (M3 — push back, take the structural fix),
  reflexively wanted a kill-switch to "fail closed" (M5 — wrong for a live feature), and gave
  a flat "use Mermaid" with no alternatives until pushed (M5.1). The standing rule that came
  out of this: **don't accept the first recommendation for a tooling/design choice — ask for
  the trade-offs first.**
- **It will produce a wrong CSS/import fix and you only find out by running it.** (M2 Entry 8
  is logged as "Claude's fault.") Running the dev server / build immediately after a change is
  the fast feedback loop.
- **Probabilistic features are easy to misrepresent.** The AIOps prompt-caching feature was
  *described* as working but never actually exercised (no API key in the test run, so
  `cache_read_input_tokens=0`). A feature that isn't verified is a claim, not a feature —
  doubly true for AI features.
- **Time-saved estimates are estimates.** They're self-reported and unmeasured. They're useful
  as a directional signal (~85 h over the project) but they are not a controlled measurement,
  and this log says so rather than presenting them as precise.

## The recurring lessons, distilled

1. **Paste the real thing** — errors, configs, outputs, screenshots, the spec file. Concrete
   input is the strongest predictor of a first-try answer.
2. **Plan, review the plan, execute, review the output.** Two cheap AI passes beat one
   expensive debugging session.
3. **Name your constraints in the prompt that will act on them** — the executor doesn't share
   the planner's context.
4. **Push back on the first recommendation**, especially the safe-sounding one. Ask for the
   trade-offs; the wrong default is often the plausible one.
5. **Verify claims against the code**, not against the prose describing the code.
6. **Don't log a conversation that didn't happen.** The value of this log is that all 89
   entries are real; one fabricated entry would devalue the rest. (This is why M6 Entries 1–4
   are marked for verification rather than invented wholesale.)

## Where AI mattered most, and least

- **Most:** non-obvious footguns no amount of careful reading surfaces quickly — the Keycloak
  Authority-vs-issuer split, `DefaultInboundClaimTypeMap.Clear()`, curl stripped from the
  Keycloak 26 base image, Postgres init-scripts that only run on a fresh volume, a partial
  index beating a full one. And repetitive, structured generation (four payment handlers, a
  hub + four consumers) where consistency is the whole game.
- **Least:** anything genuinely novel to the project's domain where there was no existing
  pattern to mirror and no spec to anchor to — there, AI accelerated *typing*, not *thinking*,
  and the thinking still had to be ours.

---

_End of AI Development Log. Six milestones, 89 logged conversations, ~85 hours of estimated
effort avoided, one consistent finding: AI's output quality is a direct function of how
specific, well-anchored, and honestly-reviewed the input is._
