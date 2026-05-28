# CI/CD pipeline

Four GitHub Actions workflows: three CI workflows (one per component) and one CD workflow (deploys to DOKS). Container images are pushed to **GHCR** (`ghcr.io/life-property-management/*`), tagged with both `{short-sha}` and `{branch}`. The CD workflow then upgrades the Helm release with the matching SHA tags.

![CI/CD pipeline overview](./diagrams/cicd.svg)

> **Source:** [`diagrams/cicd.puml`](./diagrams/cicd.puml). Authoritative workflow YAML lives in [`.github/workflows/`](../../.github/workflows/).

## Workflows at a glance

| Workflow | Trigger | What it does | Image produced |
|---|---|---|---|
| [`backend-ci.yml`](../../.github/workflows/backend-ci.yml) | push / PR on `backend/**`, `MyProperty.sln` | restore → format check → build (Release, `-warnaserror`) → xUnit + Testcontainers (101 tests, ~30 s) → docker build → Trivy → SBOM → push | `myproperty-api` + `myproperty-migrations` |
| [`frontend-ci.yml`](../../.github/workflows/frontend-ci.yml) | push / PR on `frontend/**` | `npm ci` → ESLint → `tsc --noEmit` → Jest + jest-axe → Playwright e2e → bundle build + analyzer → docker build → Trivy → SBOM → push | `myproperty-frontend` |
| [`aiops-webhook-ci.yml`](../../.github/workflows/aiops-webhook-ci.yml) | push / PR on `infrastructure/aiops-webhook/**` | pip install → ruff check + format → pytest → docker build → Trivy → SBOM → push | `myproperty-aiops-webhook` |
| [`cd.yml`](../../.github/workflows/cd.yml) | push to `main` or `develop` | `doctl kubeconfig save` → `helm dep update` → `helm upgrade --install --atomic --wait --timeout 10m` → Discord notify | — |

## Image tag strategy

Each CI workflow pushes two tags per build:

- `:{short-sha}` — immutable, used by the CD workflow's `--set <component>.image.tag={SHA}`.
- `:{branch}` — moving tag (`:main`, `:develop`, `:my-feature`) for human convenience.

This is what makes the CD step a no-op when the SHA hasn't changed and a known-good rollforward when it has. `helm rollback` to the previous release retrieves the previous SHA tag automatically.

## Security gates

Every Dockerfile is scanned twice by Trivy:

1. **SARIF upload** with severity `HIGH,CRITICAL` — non-blocking, results show up in the GitHub Security tab for triage.
2. **Blocking gate** with severity `CRITICAL` only — a fresh CRITICAL CVE fails the build.

Plus per-image:

- **CycloneDX SBOM** generated and uploaded as a workflow artifact (90-day retention).
- **Base image digests pinned** via `@sha256:...` in the `FROM` directives.
- **Non-root user** enforced at runtime (UID 1654 backend, UID 65532 frontend, dedicated `aiops` user).

## CD specifics

```bash
helm upgrade --install myproperty ./helm/myproperty \
  --namespace myproperty --create-namespace \
  --atomic --wait --timeout 10m \
  --set postgres.enabled=false \
  --set backend.image.tag=$SHA \
  --set frontend.image.tag=$SHA \
  --set migration.image.tag=$SHA \
  --set aiopsWebhook.image.tag=$SHA
```

Three things worth flagging:

1. **`postgres.enabled=false`** — production uses **DO Managed PostgreSQL** (Terraform-provisioned, credentials from the `myproperty-postgres` Secret). The in-cluster `postgres-statefulset` template is *only* used in dev / Helm-local testing.
2. **`--atomic`** — if any resource fails to roll, Helm rolls back to the previous release. Migration runs as a **pre-upgrade Helm Hook**, so a failed migration takes everything else with it (back to the previous SHA).
3. **`--wait`** + **`--timeout 10m`** — the workflow blocks until all pods report Ready, or fails after 10 minutes.

## Discord notification format

```
✅ deploy develop → cluster
• release: myproperty
• sha: a1b2c3d
• actor: drinprekaj
• run: github.com/.../actions/runs/...
```

On failure: `❌ deploy failed ...` with a hint that `--atomic` rolled back automatically.

## Conventional Commits + changelog

Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/). Automated changelog generation runs from Conventional Commit prefixes (`feat:`, `fix:`, `chore:`, `refactor:`, `docs:`, etc.). Dependabot PRs land with the `Bump` prefix.

## What this pipeline does *not* do (yet)

- **No promotion gate** between `develop` and `main`. Both branches deploy to the same cluster via the same `cd.yml`. A multi-environment promotion path is post-M5.
- **No canary / blue-green.** Releases are atomic rollouts; rollback is via `helm rollback`. K8s' default rolling update plus `helm --atomic` is enough at MVP scale.
- **No release tags / GitHub Releases.** Image SHAs are the immutable identifier; changelog lives in the repo.
