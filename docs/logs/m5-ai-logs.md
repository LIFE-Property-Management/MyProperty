# Milestone 5 AI Logs

## Summary

These are the conversations that were made with AI for consultation,
implementation and quality review during the fifth milestone of the project.
M5 was the fullstack integration & hardening milestone, so the entries below
cluster around the three themes the deliverable calls for: **architecture
decisions** (the system diagram, the DOKS→Hetzner platform pivot, the schema
review, the feature-flag tool choice), **debugging** (the auth issuer mismatch
that blocked every real login, the Unleash deploy crashloop), and **PR review**
(catching a stale finding in the M5.4 audit, and pressure-testing the M5.6
fail-open kill-switch).

# Entries

---

### Entry 1

**Date:** 27/05/2026

**Tool used:** Claude — chose the tool for the M5.1 system architecture diagram by comparing candidate formats before committing.

**Prompt / input:**
> I need to produce the M5.1 architecture diagram — every service in the stack labelled, every technology decision justified. What should I author it in?

**Output quality:** Required one correction up front. The first answer was a flat "use Mermaid" recommendation with no alternatives weighed. I pushed back and asked for a small sample of the *same* subgraph (frontend → ingress → API → Postgres/Redis/Keycloak) rendered in each candidate format — Mermaid, D2, and a draw.io/Excalidraw hand-layout — before picking one. With the samples side by side the trade-offs were concrete: Mermaid renders inline on GitHub with zero tooling but fights you on layout for a 15-node graph; D2 produces a cleaner auto-layout but needs a CLI render step committed alongside the source; a hand-drawn canvas looks best but drifts from reality the moment the stack changes. That comparison is what made the decision defensible rather than arbitrary.

**Time saved estimate:** ~30 minutes — and more importantly it avoided committing to a diagram format I'd have had to redo. The value wasn't speed, it was not picking the wrong tool blind.

**Lessons learned:** For any tooling choice, don't accept the first recommendation — ask for a sample artifact in each candidate format and compare them directly. A blind "use X" recommendation skips the only part of the decision that actually matters (what the output looks like for *our* specific case). This became a standing rule after this conversation.

---

### Entry 2

**Date:** 29/05/2026

**Tool used:** Claude — diagnosed why every real login was being rejected at the API while bringing the end-to-end Keycloak auth flow up locally (M5.2).

**Prompt / input:**
> Hosted login completes and the browser comes back with a token, but every authenticated API call fails with `error_description="The issuer 'http://localhost:8080/realms/MyProperty' is invalid"`. The realm and audience look right. What's wrong?

**Output quality:** Worked first try once given the symptom plus the relevant `Program.cs` JWT config. Claude identified the Authority/MetadataAddress split as the cause: .NET derives the set of *valid* issuers from the OIDC discovery document, which we fetch over the in-cluster/in-compose service name (`keycloak:8080`), but the browser obtains its token from the public URL, so the token carries `iss=http://localhost:8080/...`. The two never match and `Program.cs` never pinned `ValidIssuer` explicitly. The fix was a one-liner — `ValidIssuer = keycloakAuthority` in `TokenValidationParameters` — which is also the correct production shape, not just a local patch. This was one of three bring-up bugs that session (the other two: `.env` had been filled with the HTTPS `.env.proxy` redirect URIs, and `login()` called the keycloak-js adapter before `init()`); the issuer one was the genuinely non-obvious one.

**Time saved estimate:** ~60 minutes. The Authority-vs-issuer distinction is exactly the kind of thing you stare at for an hour because the config "looks correct" — every field is set, nothing is obviously wrong, and the error message points at the symptom (issuer) rather than the cause (where the discovery doc was fetched from).

**Lessons learned:** When you split Authority and MetadataAddress (different internal vs public hostnames — which you do the moment Keycloak runs behind a service name), you must pin `ValidIssuer` to the public authority explicitly. Giving Claude the exact error string *and* the config block, rather than describing it, is what made the diagnosis first-try.

---

### Entry 3

**Date:** 31/05/2026 – 01/06/2026

**Tool used:** Claude — architecture decision for deploying the monitoring stack onto the shared Hetzner cluster (`project-02`) where we only hold a namespace-scoped ServiceAccount.

**Prompt / input:**
> The DOKS plan is dead — we're on a shared Hetzner cluster with namespace-admin only, no cluster-scoped access. The Helm chart pulls in `kube-prometheus-stack`. Can that work here, and if not, what's the minimal replacement?

**Output quality:** The architectural call was correct and saved a dead-end. Claude flagged that `kube-prometheus-stack` is operator-based and creates cluster-scoped objects (the CRDs, plus `ClusterRole`/`ClusterRoleBinding`) that a namespace-admin SA simply cannot install — so the dependency had to go entirely, not be reconfigured. The recommended replacement was self-contained, namespace-scoped manifests: standalone Prometheus with a static scrape config and alert rules as ConfigMaps (no `ServiceMonitor`/`PrometheusRule` CRDs), standalone Alertmanager and Grafana with file-based provisioning, and Promtail downgraded from `ClusterRole` to a namespaced `Role` that tails only `project-02` pods. It also caught the unrelated-but-fatal storage detail — the PVCs still referenced `do-block-storage`, which doesn't exist on Hetzner; they had to move to `longhorn`.

**Time saved estimate:** ~90 minutes. Trying to make the operator work under a namespaced SA — fighting CRD-install permission errors one at a time — before concluding it's structurally impossible is a classic time sink. Getting "this whole approach can't work here, here's the namespace-scoped shape instead" up front skipped that entirely.

**Lessons learned:** Operator-based Helm charts assume cluster-scoped install rights; on a shared/namespaced cluster they're a non-starter and you want standalone workloads + ConfigMap-driven config instead. The deciding question — "does this chart create any cluster-scoped objects?" — should be asked *before* adding any operator dependency, not after the install fails.

---

### Entry 4

**Date:** 02/06/2026

**Tool used:** Claude — reviewed the database schema for the M5.3 normalization analysis (3NF verdict + crow's-foot ERD).

**Prompt / input:**
> Here's the schema (6 tables, 7 FKs, all `ON DELETE RESTRICT`) derived from the EF Core model snapshot. Is it in 3NF? Argue any apparent redundancies either way — I don't want to just assert "yes, 3NF" without defending it.

**Output quality:** Worked first try and the reasoning is what made the review credible rather than a rubber stamp. 2NF holds trivially (single-column uuid surrogate keys, so there are no partial-key dependencies to worry about). For 3NF, the value was in dismantling the *apparent* violations rather than ignoring them: the `Currency` column on payments looks duplicated but is a deliberate point-in-time snapshot, not a derived value; the identity/terms columns on `invites` look like they belong on `users`/`leases` but are a lifecycle-distinct capture — the invite exists *before* both the user account and the lease — so they're not transitively dependent on a key that exists yet; and the dual-role `users` table defers role authority to Keycloak rather than duplicating it. Claude also surfaced non-blocking follow-ups (extract receipt/OCR columns to a 1:1 `payment_receipts` table, enum CHECK constraints, a single-active-lease index) and correctly kept them as *recorded* follow-ups rather than implementing them, since M5.3 is a review and those are schema-changing migrations.

**Time saved estimate:** ~45 minutes. Writing a normalization analysis that actually argues the edge cases — instead of just claiming "3NF ✅" — is the difference between a real review and a checkbox. The lifecycle argument for the invites columns in particular is the kind of justification that's easy to feel but hard to write tightly.

**Lessons learned:** A 3NF claim is only worth anything if you name the apparent redundancies and explain why each is *not* a transitive dependency. "Point-in-time snapshot" and "lifecycle-distinct capture" are the two recurring justifications for columns that look duplicated but aren't. Keeping review follow-ups separate from the review itself kept the deliverable honest.

---

### Entry 5

**Date:** 02/06/2026 – 03/06/2026

**Tool used:** Claude — PR review of the M5.4 performance audit report; caught a stale finding by cross-checking a claim against the actual code.

**Prompt / input:**
> Review this M5.4 audit draft before I open the PR. Don't just read it — verify the concrete claims against the code on this branch.

**Output quality:** The most valuable catch was a self-correction Claude wouldn't have made if it had only read the prose. The draft's Redis section claimed that only `AcceptInviteHandler` invalidates the landlord-dashboard cache and that `Submit`/`Confirm`/`RejectPaymentHandler` still needed `InvalidateAsync` wired — flagged as a P2 "finish wiring" item. Cross-checking against the handlers on the branch showed invalidation was *already* wired across every relevant write path (CreateProperty, CreatePayment, Submit/Confirm/Reject payment, AcceptInvite, TerminateLease). The root cause was that the finding had been copied verbatim from a stale M3.5 README table that predated the wiring. The fix was to restate the item as done and downgrade it from P2 to a P3 doc-only README refresh — and to fix the stale README that caused the error in the first place.

**Time saved estimate:** ~40 minutes, and it prevented something worse than time: shipping an audit report that tells the reader a caching gap exists when it doesn't. A performance audit that's wrong about the current state of the code undermines the whole document.

**Lessons learned:** "Verify the claim against the code, don't just read the claim" is the single most useful instruction for reviewing any audit or docs PR. Findings copied from older docs are the highest-risk content in a report — they were true once, which is exactly why nobody re-checks them. When a stale finding is caught, fix the upstream doc too, or it'll get copied again.

---

### Entry 6

**Date:** 03/06/2026

**Tool used:** Claude — feature-flag tool selection and abstraction design for M5.6 (the receipt-OCR kill-switch).

**Prompt / input:**
> M5.6 wants a feature flag. The brief mentions LaunchDarkly or Unleash. We self-host everything else (Keycloak, Grafana, RabbitMQ). Pick the tool and design the integration so the SDK doesn't leak into Application.

**Output quality:** The tool decision was quick and well-justified — self-hosted Unleash OSS over LaunchDarkly's SaaS, because a managed external dependency would be the only non-self-hosted piece in an otherwise fully self-hosted stack, and a flag service going down shouldn't pull in an outside vendor. The design was the more valuable part and needed no structural rework: an `IFeatureFlags` abstraction in the Application layer (keeping the Unleash SDK out of Application per the Clean Architecture dependency rule), a real `UnleashFeatureFlags` implementation that reads an in-memory snapshot refreshed by a background poller (no per-call network I/O) and *never throws* — on error it logs and returns the caller's supplied default — and a `NullFeatureFlags` no-op used when no API token is configured, paralleling the existing `NullEventPublisher`. The chosen flag, `payments.ocr-autoextract`, gates the *paid* Anthropic OCR call, which has a clean manual-entry fallback — the most defensible real use of a flag (a cost/incident kill-switch) rather than a contrived toggle.

**Time saved estimate:** ~50 minutes. The abstraction shape (graceful-degradation provider + null provider + centralized keys, mirroring the existing caching/messaging DI split) is the kind of thing that's obvious in hindsight but takes a while to get clean from scratch. Anchoring it to the patterns already in the codebase made it consistent on the first pass.

**Lessons learned:** For a feature-flag integration, the SDK-isolation decision (`IFeatureFlags` in Application, implementations in Infrastructure) matters more than the tool choice — it's what lets the tool be swapped later. Picking a flag that gates a real cost/risk (a paid external API with a safe fallback) makes the deliverable defensible; a toggle on something trivial doesn't demonstrate anything.

---

### Entry 7

**Date:** 03/06/2026

**Tool used:** Claude — debugged two failures bringing Unleash up on the live `project-02` cluster (M5.6 deploy).

**Prompt / input:**
> The Unleash pod is crashlooping on the cluster with `database "unleash" does not exist`, even though `postgres-init.sh` is supposed to create it. And once that's fixed the backend still can't reach it. Help me untangle both.

**Output quality:** Both diagnoses were correct. The crashloop: `files/postgres-init.sh` only runs on a *fresh* Postgres data directory (the container's first-init hook), but the cluster's Postgres PVC already had data from the earlier deploy, so the init script never re-ran and the `unleash` database was never created. The fix is a one-time manual `kubectl exec <postgres-pod> -- psql -U postgres -c "CREATE DATABASE unleash;"` — and the gotcha is now documented so the next person doesn't lose time to it. The second failure was the default-deny NetworkPolicy baseline silently blocking `backend → unleash:4242` (and `unleash → postgres:5432`): without the rendered `myproperty-unleash` policy the connection just fails and the backend quietly falls back to `NullFeatureFlags`, so the flag *appears* to work (it serves defaults) while never actually talking to Unleash — the worst kind of failure because nothing errors loudly.

**Time saved estimate:** ~45 minutes. The "init script only runs on a fresh volume" behavior is a well-known Postgres-container footgun once you've hit it, but it's invisible if you haven't — the script is right there in the repo, so the instinct is to assume it ran. The silent NetworkPolicy fallback is worse: it presents as success.

**Lessons learned:** A database-init script that runs only on first-init is a latent trap on any already-provisioned volume — adding a new database after the fact needs a manual create. And under a default-deny NetworkPolicy, a *graceful-degradation* client (one that falls back instead of erroring) will mask a missing egress rule as success; when a flag "works" but never reflects toggles, suspect the network path before the flag config.

---

### Entry 8

**Date:** 03/06/2026

**Tool used:** Claude — PR review of the M5.6 Unleash PR; pressure-tested the fail-open default and the test plan.

**Prompt / input:**
> Review the Unleash PR. Start with the description and the design decisions — anything that looks wrong or under-justified?

**Output quality:** The review correctly resisted a tempting wrong instinct. The flag defaults **ON** (`defaultValue: true`, fail-open) — and "a kill-switch that defaults open" reads, at first glance, like a bug a reviewer should flag. Claude worked through why it's actually right: OCR runs unconditionally today, so the flag is a human-flipped cost/incident kill-switch layered onto a *shipped* feature, not a fail-closed gate — and a shipped feature shouldn't silently disable itself just because Unleash is briefly unreachable. The right review outcome wasn't "change it to fail-closed" but "confirm the fail-open default is deliberate, documented at the call site, and that fail-closed is available opt-in via `defaultValue: false`" — all of which held. On the test plan, it confirmed the meaningful cases were covered: flag OFF → no OCR job enqueued, ON → enqueued once, no-receipt → never enqueues regardless of flag, and the graceful-degradation case (Unleash stopped → submission still succeeds, OCR continues on the default).

**Time saved estimate:** ~30 minutes — mostly by *not* generating a wrong review comment. A reviewer reflexively flagging "kill-switch should fail closed" would have sent the author to re-justify a decision that was already correct and documented, wasting a round-trip.

**Lessons learned:** "Fail-open vs fail-closed" for a flag is a design decision that depends on whether the gated feature is already shipped — a kill-switch on a live feature *should* fail open. The reviewer's job there is to confirm the default is intentional and reversible, not to assume the safe-sounding direction is correct. And for any flag PR, the test plan must include the provider-unreachable case — that's the path most likely to behave differently than expected in production.
