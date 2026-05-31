# CI/CD Pipeline

This document describes MyProperty's continuous **integration** pipeline. There is
currently **no automated continuous deployment**: the build/test/push workflows publish
images to GHCR, and **deployment is manual** via `infrastructure/gjirafa/deploy.sh` against
the Hetzner `project-02` namespace (see [k8s-deployment.md](./k8s-deployment.md)).

> The old DOKS deploy workflow (`.github/workflows/cd.yml`) was **removed** — it targeted
> the abandoned DigitalOcean cluster and failed on every push. Building a real Hetzner CD
> workflow (GHCR images → `helm upgrade` against `project-02`) is tracked in
> [deployment-roadmap.md](./deployment-roadmap.md).

## Overview

Four CI workflows cover the services + Keycloak in the repo:

| Workflow | Covers | Triggers |
|---|---|---|
| `.github/workflows/backend-ci.yml` | `.NET 10` API + EF migration bundle | `backend/**`, `MyProperty.sln` |
| `.github/workflows/frontend-ci.yml` | `Next.js 16` frontend | `frontend/**` |
| `.github/workflows/aiops-webhook-ci.yml` | `Python` FastAPI service | `infrastructure/aiops-webhook/**` |
| `.github/workflows/realm-import-ci.yml` | Keycloak realm export smoke test (boots Keycloak on Postgres, verifies the service account) | `infrastructure/keycloak/**`, `docker-compose.yml` |

The three image workflows follow the same pattern:

1. **Lint** — format/style gate fails fast.
2. **Test** — unit suite runs against the source tree.
3. **Build** — Docker image built (and pushed to GHCR on `push` events).
4. **Scan** — Trivy CVE scan against the built image; SARIF uploaded to the
   GitHub Security tab.

## Registry & tag scheme

All images push to `ghcr.io/life-property-management/`:

- `myproperty-api` — backend runtime image.
- `myproperty-migrations` — EF Core migration bundle (from M4 unblock sprint, Plan 5 (D2)).
- `myproperty-frontend` — Next.js frontend.
- `myproperty-aiops-webhook` — FastAPI alert triage service.

Each image is dual-tagged on push:

- `<short-sha>` (immutable) — production references must use this tag.
- `<branch>` (mutable) — convenience tag for human inspection.

The migration bundle uses the same scheme via `backend/scripts/build-migration-bundle.sh`.

## Trivy scanning

Every image-build job runs a **two-pass** Trivy scan after the push step
(updated M4.8 — was single-pass non-blocking in M4.3).

**Pass 1 — SARIF report (non-blocking):**
- **Severities scanned:** `CRITICAL`, `HIGH`.
- **`exit-code: '0'`** — never fails the build.
- **Output:** SARIF, uploaded to the GitHub Security tab via
  `github/codeql-action/upload-sarif@v4` so the Security tab keeps full
  visibility into both severity levels.

**Pass 2 — quality gate (blocking):**
- **Severities scanned:** `CRITICAL` only.
- **`exit-code: '1'`** — fails the build on any unsuppressed finding.
- **Output:** table format to the workflow log so the failure is debuggable
  without leaving the run.

Both passes honor `trivyignores: .trivyignore` at the repo root for triaged
exceptions. The full triage workflow lives in
[security-hardening.md](security-hardening.md#trivy-quality-gate).

**Why blocking on CRITICAL only:** transitive dependencies in the .NET and
Next.js ecosystems regularly carry HIGH-severity advisories that don't apply
to our usage profile; blocking the pipeline on every HIGH would produce
frequent false-positive failures. CRITICAL-only gating catches the
genuinely actionable findings while leaving HIGH visible in the Security
tab where they can be triaged on a schedule.

**`ignore-unfixed: true`** applies to both passes — advisories without a
published fix are filtered out (no actionable signal).

## SBOM artifacts

M4.8 added CycloneDX SBOM generation as a final step on each image-build
job. The artifact is uploaded with a 90-day retention and named
`sbom-<service>-<short-sha>.cdx.json`. Useful for downstream audits and for
re-scanning a built image against a future CVE feed without rebuilding.

## Dependabot

`.github/dependabot.yml` opens weekly PRs across all five ecosystems:

- NuGet (root)
- npm (`/frontend`)
- pip (`/infrastructure/aiops-webhook`)
- Docker (each of the three Dockerfile directories)
- GitHub Actions (root)

Open-PR limits keep review load tractable during milestone sprints.

## Base image pinning

All four Dockerfiles in the repo pin base images to immutable `@sha256:`
digests (M4.3 Phase 1). Tags are retained alongside digests as
human-readable labels. Dependabot's Docker ecosystem entries surface digest
updates as PRs.

## What's deliberately out of scope for M4.3

These were explicit decisions for the milestone — not oversights. All are
documented for post-M4 follow-up.

### ~~Trivy posture: non-blocking → blocking~~ — CLOSED in M4.8

The two-pass model (non-blocking SARIF + blocking CRITICAL gate) plus a
baseline `.trivyignore` was shipped in M4.8. See
[security-hardening.md](security-hardening.md#trivy-quality-gate) for the
triage workflow.

### Integration tests in CI

Backend integration tests (`MyProperty.Tests/Integration/`, 22 tests at M3.11)
require Testcontainers spinning up Postgres + Keycloak. They run locally
pre-merge but **not in CI**. Reason: cold image pulls add 3–5 minutes per
run, and the test infrastructure is the same suite verified at M3.11 close.

Post-M4 follow-up: add a second backend CI job (`integration-tests`) that
runs only on PRs to `main`, with the Docker daemon pre-configured for
Testcontainers and a registry mirror for Postgres + Keycloak.

### End-to-end image smoke test

Frontend↔backend OIDC + API integration is not yet wired (see M4.2 entry,
G18 verification note). A meaningful end-to-end CI smoke test isn't possible
until that integration lands. M4.3 verifies each image builds cleanly; that
is the verification.

Post-M4 follow-up: once frontend↔backend auth is wired, add a final
compose-up + curl-loop job that exercises the OIDC redirect dance and an
authenticated API call against the just-built images.

### CD (deploy step) — currently manual

There is no automated deploy. Images built here are deployed by hand: pin the short-SHA
tag in `helm/myproperty/values-gjirafa.yaml` and run `infrastructure/gjirafa/deploy.sh`
(see [k8s-deployment.md](./k8s-deployment.md)). The DOKS `cd.yml` that previously ran on
push was removed. A namespace-scoped Hetzner CD workflow (deploy to `project-02` via a
kubeconfig secret) is planned — see [deployment-roadmap.md](./deployment-roadmap.md).

### Node.js 24 migration

GitHub Actions deprecates Node.js 20 for JavaScript actions on **June 2,
2026**. Before then, the following bumps land together:

- `docker/login-action@v3` → `@v4`
- `docker/setup-buildx-action@v3` → `@v4`
- `docker/build-push-action@v6` → `@v7`
- `actions/setup-node` `node-version: 20` → `24` in frontend-ci.yml
- `frontend/Dockerfile` runtime base `node:20-alpine` → `node:24-alpine`
  (re-verify image size, healthcheck, standalone behavior — re-runs M4.2
  G10–G15 verification gates).

Dependabot's `github-actions` and `docker` ecosystem entries will surface the
action-version bumps and base image bumps automatically; the `actions/setup-node`
`node-version` bump and the bundled M4.2 verification re-run require manual
coordination as a batched change.

### Frontend `NEXT_PUBLIC_*` baked at build time — single environment

`NEXT_PUBLIC_*` values are inlined into the Next.js bundle at build time, so they are
fixed per image. `frontend-ci.yml` hardcodes the **production** URLs
(`https://api.myproperty.works`, `https://auth.myproperty.works`, realm `MyProperty`,
client `myproperty-frontend`, `DEV_AUTH_BYPASS=false`). There is **one environment**, so
the CI image is deployable as-is.

Multi-environment support (parameterising these via `workflow_dispatch` inputs so the same
pipeline can target staging/prod) is deferred — tracked in
[deployment-roadmap.md](./deployment-roadmap.md). When deploying a specific commit
manually, build the image with these same args (see the frontend build step in
[k8s-deployment.md](./k8s-deployment.md)).

### `frontend-image` job does not depend on `e2e-tests`

The `frontend-image` job gates on `[lint, typecheck, unit-tests]` and
deliberately omits `e2e-tests` (Playwright) from its `needs:` list.
Playwright is slow (~10+ min on cold cache), can fail for unrelated reasons
(network flakes, browser version drift), and is not on the critical path for
image build. The trade-off: an image can push with failing E2E tests.
Justified for M4.3; post-M4, consider adding a separate "release gate" job
that requires all four green before tagging a `release-*` tag.

## Local equivalents

Developers can run every CI step locally before pushing:

```bash
# Backend
dotnet format MyProperty.sln --verify-no-changes
dotnet build MyProperty.sln -c Release -warnaserror
dotnet test MyProperty.sln -c Release --no-build
docker build -f backend/Dockerfile -t myproperty-api:local backend/

# Frontend (from frontend/)
npm ci
npm run lint
npm run typecheck
npm test -- --ci
# First time only — installs the browser binaries Playwright needs
npx playwright install --with-deps chromium
npx playwright test
docker build -f Dockerfile -t myproperty-frontend:local \
  --build-arg NEXT_PUBLIC_API_BASE_URL=http://localhost:5042 \
  --build-arg NEXT_PUBLIC_KEYCLOAK_URL=http://localhost:8080 \
  --build-arg NEXT_PUBLIC_KEYCLOAK_REALM=MyProperty \
  --build-arg NEXT_PUBLIC_KEYCLOAK_CLIENT_ID=myproperty-frontend \
  .

# AIOps webhook (from infrastructure/aiops-webhook/)
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt -r requirements-dev.txt
ruff format --check .
ruff check .
pytest -v
docker build -t myproperty-aiops-webhook:local .

# Trivy (any image)
trivy image --severity CRITICAL,HIGH --ignore-unfixed <image-ref>
```

## Operational notes

- **Concurrency:** every workflow has `cancel-in-progress: true` keyed by
  `github.ref`. Pushing a new commit to a branch cancels the in-flight run
  for that branch, freeing the runner.
- **GHCR permissions:** workflows use the auto-provisioned `GITHUB_TOKEN`
  with `packages: write` — no PAT setup required.
- **Cache:** `cache-from: type=gha` / `cache-to: type=gha,mode=max` reuses
  BuildKit layers across runs. First run cold ~25–60 s per image; warm runs
  ~5–15 s.
- **Image cleanup:** GHCR retains all pushed tags indefinitely. Periodic
  cleanup of branch-tagged images is a post-M4 follow-up — consider a
  scheduled workflow that prunes branch tags older than 30 days.
