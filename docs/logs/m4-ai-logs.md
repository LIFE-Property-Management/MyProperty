# Milestone 4 AI Logs

## Summary

These are the conversations that were made with AI for consultation,
implementation and quality review during the fourth milestone of the project.

# Entries

---

### Entry 1

**Date:** 13/05/2026

**Tool used:** Claude — used to plan and prioritize the M4 unblock sprint by grouping nine dev-prod audit gaps into ordered execution plans.

**Prompt / input:**
> Nine items from the `dev-prod-gaps.md` audit are blocking any serious Docker/Helm/CI-CD work. Group them, decide the order, and give me a concrete execution plan for each.

**Output quality:** Worked first try. Claude grouped the nine blockers into five coherent plans (origin & routing, frontend build-time config, realm config, K8s readiness, migration bundle), ordered them by dependency, and produced a flat Claude Code–ready spec for each. The key insight it surfaced — that building Docker/Helm/CI-CD on top of an app with CORS errors, redirect loops, and Keycloak auth failures is a guaranteed stall — shaped the entire M4 sequencing decision.

**Time saved estimate:** ~90 minutes. Manually reading and re-grouping nine cross-cutting audit items, reasoning about their dependency order, and deciding which had to land before the first `docker compose up` attempt would have taken significant time and likely produced a worse sequence.

**Lessons learned:** Audit-to-execution-plan conversion is a strong Claude use case. Providing the full `dev-prod-gaps.md` alongside CLAUDE.md produced a prioritization that didn't need to be relitigated. The dependency reasoning ("you can't usefully harden what can't boot") is exactly what Claude is good at when given the full context.

---

### Entry 2

**Date:** 13/05/2026

**Tool used:** Claude — planned the frontend build-time config fix (Plan 2: F1, F2, A2) including a `requirePublicEnv()` helper for Next.js.

**Prompt / input:**
> Plan 2 of the unblock sprint: Next.js `NEXT_PUBLIC_*` variables need to be safely inlined at build time and must not be baked from `.env.local` in production Docker images.

**Output quality:** Required one mid-execution correction. The initial `requirePublicEnv()` implementation used a dynamic `process.env[name]` lookup, which defeats Next.js/Turbopack's static replacement and leaves the variable as an undefined runtime lookup in the client bundle. Claude had flagged this class of bug during planning; the implementation ignored the warning and it was caught during bundle verification. Restructuring to a literal lookup-table resolved it. The `.dockerignore` additions and guard behavior (production-fatal when a required var is missing, warn-only in dev) needed no corrections.

**Time saved estimate:** ~45 minutes. Correctly understanding how Turbopack inlines environment variables — specifically that only literal `process.env.NEXT_PUBLIC_X` accesses are replaced, not dynamic bracket notation — is non-obvious and not well-documented. Without Claude surfacing this upfront, the bug would likely have been found much later during a Docker deploy rather than during local verification.

**Lessons learned:** When Claude flags a constraint during planning ("dynamic access defeats static replacement"), write it down. The implementation step was handed to Claude Code which didn't have the planning conversation in context, and the warning was lost. Next time: include the planning constraints explicitly in the Claude Code prompt.

---

### Entry 3

**Date:** 16/05/2026

**Tool used:** Claude — diagnosed a silent Keycloak healthcheck failure and planned the realm production-readiness overhaul (Plan 3: A6, E5).

**Prompt / input:**
> Plan 3 of the unblock sprint: `realm-export.json` needs to become a deployable template using `envsubst`, and Keycloak needs a working healthcheck for Docker and K8s.

**Output quality:** Required one correction direction. The initial healthcheck recommendation was `curl`-based — which had been silently failing since the Keycloak 26 UBI Micro image stripped curl from its base. Claude identified the failure when I described the container being stuck in `health: starting` indefinitely, then recommended switching to an inline Java probe compiled at runtime using the bundled JRE. The `PRODUCTION.md` runbook it drafted for the DevOps teammate was used verbatim: env-var checklist for `start --import-realm` mode, init-container pattern with a Helm-translated K8s example, the JWT issuer-vs-authority mismatch gotcha, and the Keycloak port 9000 native probe recommendation.

**Time saved estimate:** ~60 minutes. Discovering that curl had been stripped from the Keycloak 26 base image — and that the probe had been "passing" only because the container was never health-checked — could have gone undetected until the first real cluster deploy. The Java probe workaround is non-obvious and not in the Keycloak docs.

**Lessons learned:** Don't trust healthcheck patterns across base image bumps. Always verify that the tooling your probe depends on actually exists in the image. Mentioning the base image name + version when asking about healthchecks gives Claude the context to flag stripped tooling upfront rather than after the fact.

---

### Entry 4

**Date:** 17/05/2026

**Tool used:** Claude — reviewed the M4.1 Docker Compose file against the deliverable checklist and flagged a service-count discrepancy.

**Prompt / input:**
> Does this docker-compose.yml fulfill the requirements for M4.1?

**Output quality:** Worked first try. Claude mapped each required service to the compose file, confirmed all eleven M4.1 services were present, and flagged one important scoping issue: the file pasted also contained M4.5 additions (Alertmanager service, Prometheus alert rules, `depends_on: alertmanager`) that weren't part of the M4.1 commit. It noted that claiming this exact YAML as the M4.1 deliverable in writing would be inaccurate — M4.1 and M4.5 are layered in the same file, and a grader comparing the scratch log description (10-of-11 services) against the actual file (12 services) would see a mismatch.

**Time saved estimate:** ~20 minutes. The service-count discrepancy between the scratch log and the compose file was the kind of detail that's easy to miss when reviewing your own work. Catching it before submission rather than during a grader review was the value.

**Lessons learned:** Deliverable checklist reviews are a good Claude use case even when you're fairly confident something is correct. The "does this match what the milestone doc says" check is mechanical but easy to skip when tired. Worth making it a habit before every milestone submission.

---

### Entry 5

**Date:** 18–19/05/2026

**Tool used:** Claude — PR review for M4.5 (Prometheus/Alertmanager/Grafana monitoring stack).

**Prompt / input:**
> Let's review this PR together. Starting with the PR description — see anything suspicious?

**Output quality:** Caught two real issues before any files were opened. First: test count regressed from 101 to 86 with no explanation in the PR description — pushed back; turned out to be a unit-only filter in the test command, not a real regression, but the description should have called it out. Second: the CORS gap in the Prometheus scrape config — the `/metrics` endpoint was not exempted from the default auth fallback policy, so the Prometheus target was going to show `UP` only after an auth fix landed that wasn't in this PR. Both issues were caught at the description stage before touching a single file.

**Time saved estimate:** ~40 minutes. The systematic "description first, then files" approach surfaces inconsistencies between what the PR claims and what the test plan covers. Finding them at the PR description stage is faster than finding them during file review or, worse, during the demo.

**Lessons learned:** Making Claude read the PR description before any files is a reliable first filter. "What does the PR claim vs what does the test plan actually verify" is the key question to ask at the description stage. The test-count discrepancy is a pattern worth watching — it appeared here and in M3 reviews too.

---

### Entry 6

**Date:** 19–20/05/2026

**Tool used:** Claude — PR review for M4.11 (AIOps webhook: Alertmanager → Claude Haiku → Slack).

**Prompt / input:**
> Let's review this PR together. Starting with the PR description — see anything suspicious?

**Output quality:** The most important finding was the strikethrough in the test plan: the PR described prompt caching as a feature but admitted it was never actually verified end-to-end — the test was run without an `ANTHROPIC_API_KEY`, so no LLM call was made. Claude flagged this clearly: the caching code path was unverified, not a tested feature. It also caught that the 202 return-always contract (needed to prevent Alertmanager retry storms) was explained in the decisions section but not called out in the test plan, making it look like an oversight rather than a deliberate design choice.

**Time saved estimate:** ~30 minutes. The prompt-caching gap specifically would have been a problem at demo time — claiming a feature that produces `cache_read_input_tokens=0` in the response is not a strong demo. Finding it in review rather than live saved a re-demo situation.

**Lessons learned:** When a PR description crosses out a test case, that's almost always the most important thing to look at first, not last. A feature that isn't verified isn't a feature — it's a claim. This applies double for AI-specific features where behavior is probabilistic and easy to misrepresent.

---

### Entry 7

**Date:** 20/05/2026

**Tool used:** Claude — scoped M4.3 (CI/CD pipeline) and produced a phased execution plan carrying forward three explicit deferred items from M4.2 and M4.11.

**Prompt / input:**
> M4.3: decide scope first, then produce the execution plan. Carry-over commitments: Trivy gate, digest pinning, Dependabot across .NET/npm/Docker/GHA, Python lint + pytest for the aiops-webhook. Scope decision before the plan.

**Output quality:** The scope decision phase was the most valuable part. Claude separated "what credibly ships in the time available" from "what would be nice": Trivy as a CI gate (not just a local invocation), Dependabot across all four ecosystems, and the Python CI job were all in-scope; CD pipeline wiring (auto-deploy via `helm upgrade`) was correctly called out as out-of-scope given the timeline and that the Helm chart wasn't stable yet. The resulting execution plan was phased (lint/format gates → image build gates → security gates → Dependabot config), single-commit-per-phase, with verification gates at each boundary.

**Time saved estimate:** ~50 minutes. The scope decision conversation specifically saved the most time — "what's a credible CI story vs what's theatre" is a judgment call that benefits from having a second opinion before you start writing YAML.

**Lessons learned:** For CI/CD specifically, the scope decision should always precede the plan. It's easy to end up with a pipeline that technically exists but doesn't actually gate anything meaningful. The framing "what would a grader notice is missing" is a useful lens for CI scope decisions.

---

### Entry 8

**Date:** 24/05/2026

**Tool used:** Claude — planned M4.7 two-stage Terraform (DOKS + managed Postgres 16 + Spaces buckets) and resolved a helm install failure caused by mismatched image SHAs.

**Prompt / input:**
> Let's start talking about M4.7. Produce a plan for Claude Code to execute. Split into phases with checks throughout.
> *(Later in execution):* Helm install is failing to pull images. SHA mismatch between CI-tagged images and what cd.yml is passing.

**Output quality:** The plan needed no structural corrections and was handed to Claude Code as written. The two-stage Terraform design (bootstrap stage for the state bucket, main stage for cluster + DB) was Claude's recommendation; it correctly identified that trying to provision the state backend and the main resources in one `terraform apply` creates a chicken-and-egg problem with remote state. On the SHA mismatch: Claude correctly diagnosed that the four images (backend, frontend, migrations, aiops-webhook) have independent build triggers and therefore land on different SHAs, and that `cd.yml` was passing the full 40-char `github.sha` while CI tags images with 7-char `SHORT_SHA`. It provided the exact GHCR API commands to list current tags per package and verify the correct SHAs before retrying the install.

**Time saved estimate:** ~60 minutes. The two-stage Terraform insight alone was worth the conversation — hitting the state-backend chicken-and-egg problem mid-apply and having to untangle it would have cost significantly more time. The SHA diagnosis was also fast: without understanding that per-service pipelines produce independent SHAs, you'd burn time staring at the wrong thing.

**Lessons learned:** Multi-stage Terraform (bootstrap → main) is the pattern whenever the state backend is also provisioned by Terraform. When CI publishes multiple images from separate pipeline triggers, always verify each image's actual current tag from the registry before wiring a deploy step — don't assume they share a commit SHA.

---

### Entry 9

**Date:** 25/05/2026

**Tool used:** Claude — triaged a blocking Trivy CRITICAL CVE (`CVE-2026-31789`) mid-M4.8 execution and recommended the correct remediation path.

**Prompt / input:**
> Trivy CRITICAL gate is blocking on `CVE-2026-31789` in `libssl3 3.0.18` in the frontend image. What do I do?

**Output quality:** Worked first try. Claude correctly identified that `CVE-2026-31789` is a heap buffer overflow in OpenSSL that is exploitable only on 32-bit systems — not reachable on DOKS amd64 nodes. It recommended a `.trivyignore` allowlist entry with an explicit expiry annotation and rationale comment, and separately recommended bumping `fastapi` from 0.115.6 to 0.119.0 to pull in patched `starlette` (closes two HIGH advisories via transitive dependency). It explicitly recommended against bumping all the way to the latest FastAPI for a deadline-week change, citing Pydantic v2 churn across that range.

**Time saved estimate:** ~45 minutes. Determining whether a CRITICAL CVE is actually reachable in a specific deployment topology (amd64 containerized, no 32-bit paths) requires reading OpenSSL's own advisory, not just the NVD entry. NVD severity is conservative by design. Without that analysis, the options are "block on a false positive" or "allowlist without justification" — both bad outcomes.

**Lessons learned:** For Trivy findings, always ask "is this reachable in our specific deployment topology" before choosing between fix and allowlist. The deployment context (amd64, containerized, managed cloud) is the deciding factor that NVD cannot know. The `exp:` expiry annotation on `.trivyignore` entries is important — it forces a re-triage date rather than leaving suppressions open-ended.