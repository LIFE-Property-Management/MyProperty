# CD Pipeline Deploy — Runbook & Plan

> **Execution note for the implementer (Sonnet):** This file **is** the runbook. As you execute,
> **edit it in place** — tick the `- [ ]` boxes and fill each gate's "Result:" line with real output.
> Every **GATE** is a hard stop. Mirror the batch list into TaskCreate at the start. This is the
> **second half** of `feature/monitoring-and-cd`, stacked on the completed/verified monitoring stack
> (see `monitoring-stack-plan.md`).

> **Verified against current docs (Jun 2026):** `helm --atomic` implies `--wait` + auto-rollback
> **on Helm 3** — and this pipeline **pins Helm 3.20.x** via `azure/setup-helm` (see 2.1), because
> `setup-helm@v5` now defaults to `latest` = **Helm 4**, where `--atomic` was renamed
> `--rollback-on-failure` (alias kept for `helm upgrade`, removed from `helm install`) and `--wait`
> fails fast on resource failure; `workflow_run` fires only from the **default-branch** copy of the
> workflow and runs in that context; `GITHUB_TOKEN`-pushed commits don't retrigger workflows (branch
> protection may still block them → App/PAT token); `azure/setup-helm` v5 current; pin
> `docker/build-push-action` **@v6** to match the existing CI builders (upstream is now at v7).

---

## Context

MyProperty deploys to a **shared Hetzner cluster**, namespace `project-02`, with **namespace-admin
only** (no cluster-scoped rights). Deploy today is **fully manual**: edit image tags in
`helm/myproperty/values-gjirafa.yaml`, commit, run `infrastructure/gjirafa/deploy.sh`
(`helm upgrade --install … -f values-gjirafa.yaml`, no `--wait`/`--atomic`). CI builds + pushes images
to `ghcr.io/life-property-management/*` tagged by 7-char short SHA, but **only on push to
`develop`/`main`** and **not for the uptime-kuma seed image** (hand-built). The old DOKS `cd.yml` was
deleted; its fatal bug was passing a single 40-char `${{ github.sha }}` as every component's tag while
CI tags 7-char per-component SHAs.

This automates deploy with **push-based GitHub Actions** (pull-based ArgoCD/Flux is impossible — needs
cluster-scoped CRDs + controllers we can't install), authenticating with the `project-02.kubeconfig`
as a **GitHub Environment secret**, bumping **per-component** image tags in `values-gjirafa.yaml`
(GitOps-lite auto-commit). It also closes the seed-image CI gap and folds in the deferred **Batch 9
DOKS cleanup**.

## Decisions locked (from planning conversation)

| Decision | Choice |
|---|---|
| Deploy mechanism | **Push-based GitHub Actions** + kubeconfig as a GitHub **Environment secret** |
| Deploy trigger | **Both `develop` and `main`** deploy to `project-02` (one namespace, last-deploy-wins) |
| Image-tag flow | **Auto-commit per-component tag bump** to `values-gjirafa.yaml`, then deploy from the file |
| Approval | **Manual approval gate** via a protected GitHub Environment (`project-02`, required reviewer) |
| Secrets | Stay **manual K8s Secrets** (`secrets.sh`); **no ESO** (cluster-scoped); CD is **deploy-only** |
| Verification/rollback | `deploy.sh --atomic --cleanup-on-fail --timeout 10m` + health gates on `/health/ready` + hosts |
| Cleanup scope | **Bundle Batch 9** DOKS/Terraform/nginx deletions + doc retirements |

## Hard constraints & guardrails

- **No cluster-scoped anything.** Push-based only; the kubeconfig SA is namespace-admin.
- **Pre-upgrade migration hook.** EF migrations run as a Helm **pre-upgrade hook**. CD must **never**
  wipe/auto-provision fresh stores — the hook fires before Postgres exists and aborts. The two-phase
  wipe (`deploy.sh --no-hooks` → normal `deploy.sh`) is **manual-only**. Normal upgrades unaffected.
- **Migrations are forward-only.** `--atomic` rolls back *workloads* but does **not** un-apply schema.
  Rollback messaging must say so.
- **Never decode Secrets to plaintext** (rotation-incident lesson) — verify by length/hash only.

## Image map (repos, value keys, what builds them)

| Component | GHCR repo (`…/life-property-management/`) | values-gjirafa key | Built by | Current tag |
|---|---|---|---|---|
| Backend API | `myproperty-api` | `backend.image.tag` | backend-ci (push) | `1232e70` |
| Migrations | `myproperty-migrations` | `migration.image.tag` | backend-ci (same SHA as API) | `1232e70` |
| Frontend | `myproperty-frontend` | `frontend.image.tag` | frontend-ci (push) | `8c93b63` |
| AIOps webhook | `myproperty-aiops-webhook` | `aiopsWebhook.image.tag` | aiops-webhook-ci (push) | `8f4a2f3` |
| Kuma seed | `myproperty-uptime-kuma-init` | `uptimeKuma.seedImage.tag` | **none yet — Batch 1** | `19c92bd` |

`backend` + `migration` share one SHA. The other three move independently — this is why tag resolution
must be **per-component**.

---

# Batch 0 — Branch, GitHub Environment, scaffolding

- [x] **0.1** CD branch `feature/hetzner-cd` already sits at the monitoring tip (`a7adef8`) and descends
  from `feature/monitoring-and-cd` (PR #127, open → develop). It has **zero commits of its own yet** — the
  clean CD starting point. CD PR base = **`feature/monitoring-and-cd`**; after #127 merges:
  `git rebase --onto origin/develop feature/monitoring-and-cd feature/hetzner-cd`, retarget PR base to develop.
  Tasks 1–5 created.
- [x] **0.2** Default branch = **`develop`** (`gh repo view` → `defaultBranchRef.name`). `workflow_run`
  fires only from the develop copy of `cd.yml`; pre-merge testing uses `workflow_dispatch`.
- [x] **0.3** **Environment `project-02` provisioned** (verified via API): required reviewer = `ErdiSyla`
  (`prevent_self_review: false`, so the sole reviewer can self-approve), env secret `KUBECONFIG_PROJECT_02`
  present, deployment-branch policy = {`develop`, `main`}.
- [x] **0.4** **No branch protection** on `develop`/`main` (`gh api .../branches/<b>/protection` → 404). The
  runner can push directly → tag-bump uses **`GITHUB_TOKEN`** (pushes don't retrigger workflows → loop-safe,
  no `[skip ci]`, no App/PAT). Drives 2.3.

**GATE 0:** ✅ PASS — CD branch at monitoring tip; default branch `develop`; `project-02` Environment with
required reviewer + `KUBECONFIG_PROJECT_02` + branch policy {develop,main}; tag-bump push method = `GITHUB_TOKEN`.
Result: All four items verified 2026-06-01 (see notes above). Deploy-failure Discord notice → dedicated
#deployments channel via env secret `DISCORD_DEPLOY_WEBHOOK_URL` (user-created) — NOT the in-cluster
`myproperty-discord` K8s secret (keys `webhook-url`=#alerts, `uptime-webhook-url`=#uptime), which CD never touches.

---

# Batch 1 — Close the seed-image CI gap

- [x] **1.1** Added `.github/workflows/uptime-kuma-init-ci.yml`. Mirrors the **image-build pipeline** of
  `aiops-webhook-ci.yml` (same pins: `actions/checkout@v6`, `docker/setup-buildx-action@v4`,
  `docker/login-action@v4`, `docker/build-push-action@v6`, Trivy two-pass `@v0.36.0`, SBOM,
  `codeql-action/upload-sarif@v4`, `upload-artifact@v7`). Triggers push `[develop, main]` + PRs + manual
  dispatch, path filter `infrastructure/uptime-kuma/**`; build job (push/dispatch only) against
  `infrastructure/uptime-kuma`, tags `…:${SHORT_SHA}` + `:${GITHUB_REF_NAME}`.
  **Deliberate deviations** (uptime-kuma has no test/lint scaffolding — decided with user): NO ruff/pytest
  jobs (would fail with nothing to lint/test); omitted `trivyignores:` (no `.trivyignore` exists — aiops
  references a missing one). Added `workflow_dispatch`.
- [~] **1.2** Local pre-merge validation done: **actionlint PASS**; **`docker buildx build` of the seed
  image PASS** (exact CI context/Dockerfile). The build job only runs on `push`/`dispatch` (PRs don't
  publish, by design), so the GHCR-push confirmation is **deferred to the first push on `develop`** after merge.

**GATE 1:** 🟡 PARTIAL (pre-merge) — workflow authored, lints clean, seed image builds clean locally.
Result: Verified pre-merge (actionlint + local buildx). Final GHCR-push check pending first develop push.

---

# Batch 2 — The CD deploy workflow

- [x] **2.1** Added `.github/workflows/cd.yml`:
  - **Trigger** (`workflow_run`, after the image CI workflows complete on develop/main):
    ```yaml
    on:
      workflow_run:
        workflows: ["Backend CI", "Frontend CI", "AIOps Webhook CI", "Uptime Kuma Init CI"]
        types: [completed]
    ```
    **Deliberately excludes `realm-import-ci.yml` ("Realm Import Smoke")** — it boots Keycloak to
    verify the realm export and **builds no deployable image**, so it must not trigger a deploy.
    (Caveat: realm changes therefore don't auto-deploy under CD — they ride a component deploy or a
    manual run; see Deferred follow-ups.)
    plus `workflow_dispatch` (deploys the branch it's dispatched from). **Hardened guard** (beyond the
    plan's bare `conclusion == 'success'`): also require `workflow_run.event == 'push'` (so PR-triggered CI
    can't deploy a PR branch) **and** `head_branch ∈ {develop, main}` — the Environment branch policy can't
    enforce this because `workflow_run` always executes in the default-branch context (`github.ref` = develop).
    Checks out `head_branch`; resolves `SHORT_SHA` from `workflow_run.head_sha` (dispatch → `git rev-parse HEAD`).
    ⚠️ **Pre-merge `workflow_dispatch` from `feature/hetzner-cd` is BLOCKED** by the env branch policy
    {develop,main} — see Batch 3 note for how to E2E-test.
  - **Concurrency** (shared, serialized — never two deploys on the one namespace):
    `concurrency: { group: deploy-project-02, cancel-in-progress: false }`. Multiple fires per push are
    safe — tag resolution is idempotent.
  - **Permissions:** `contents: write` (+ `packages: read` for GHCR checks).
  - **Environment:** `environment: project-02` (manual approval gate + kubeconfig secret).
  - **Helm:** `azure/setup-helm@v5` **with `version: v3.20.0`** (the locally-validated line; see
    `m4-deployment-ops-entries.md` G1). Do **not** leave it unpinned — `@v5` defaults to `latest`,
    now **Helm 4**, which changes `--atomic`/`--wait` semantics. Moving to Helm 4 is a deliberate,
    separately-tested change, not a silent runner-side jump.
- [x] **2.2** **Per-component tag resolution:** `SHORT_SHA=${FULL:0:7}`; for each repo `docker buildx
  imagetools inspect …/<repo>:<SHORT_SHA>`; present repos are passed to the bumper. Map implemented as
  specified: `myproperty-api` → **both** `backend.image.tag` + `migration.image.tag`; frontend →
  `frontend.image.tag`; aiops → `aiopsWebhook.image.tag`; kuma-init → `uptimeKuma.seedImage.tag`.
  **DEVIATION from "via yq" (decided with user):** mikefarah `yq -i` re-serialises the file (strips blank
  lines, normalises comment spacing) → unreviewed reformat in the bot commit. Replaced with a committed,
  tested helper `infrastructure/gjirafa/bump_image_tags.py` (ruamel.yaml round-trip) — verified **byte-perfect**
  (only the 5 tag values change) and **fails loudly on a bad key path**. Adds `setup-python@v6` + `pip install
  'ruamel.yaml>=0.18,<0.19'` to `cd.yml`.
- [x] **2.3** **Auto-commit:** commits only if `values-gjirafa.yaml` changed; bot identity
  `github-actions[bot]`; `git pull --rebase` then `git push origin HEAD:refs/heads/<branch>` via
  **`GITHUB_TOKEN`** (loop-safe; the bumped file also matches no CI path filter). No `[skip ci]` needed.
- [x] **2.4** **Deploy:** writes `KUBECONFIG_PROJECT_02` → `$RUNNER_TEMP/project-02.kubeconfig` (chmod 600),
  `export KUBECONFIG` via `$GITHUB_ENV`, then `bash infrastructure/gjirafa/deploy.sh --atomic --cleanup-on-fail
  --timeout 10m`. Temp kubeconfig removed in an `if: always()` cleanup step. (The repo's gitignored
  `project-02.kubeconfig` is absent in CI, so exporting `KUBECONFIG` is required — deploy.sh's fallback path
  won't exist.)
- [x] **2.5** **Health gate** — **CORRECTED PATH:** plan said `/health/ready` → returns **401** (no such
  route); the real anonymous endpoint is **`/api/v1/health/ready`** (verified → 200 `Healthy`). Gate:
  `rollout status deploy/myproperty-backend` + `…/myproperty-frontend --timeout=5m`; `curl -fsS …/api/v1/health/ready`;
  hosts `app./auth./grafana./status.` accepted if HTTP **< 400** (auth./grafana./status. legitimately 302 to login —
  a strict `== 200` would false-fail; verified live codes: app 200, others 302).
- [x] **2.6** **Failure path** (`if: failure()`): posts to **`DISCORD_DEPLOY_WEBHOOK_URL`** (project-02 env
  secret → dedicated #deployments channel, user-created) — "workloads rolled back; schema forward-only, verify
  DB manually" + run URL. NOT the in-cluster `myproperty-discord` K8s secret. Never re-provisions stores.
- [x] **2.7** **actionlint PASS** (incl. shellcheck on `run:` blocks). Also validated: `helm 3.20.0 lint`
  (0 failed; only pre-existing icon/indent notices) + `helm template -f values-gjirafa.yaml` render OK. Not live-deployed.

**GATE 2:** 🟡 PARTIAL (authored + statically validated) — `cd.yml` parses (actionlint+shellcheck);
per-component resolution + ruamel bump byte-perfect (tested); `deploy.sh --atomic --cleanup-on-fail` wired;
gates on **`/api/v1/health/ready`** (corrected) + hosts; failure → rollback + `DISCORD_DEPLOY_WEBHOOK_URL`;
serialized; behind `project-02` approval gate. The **live behaviours** (real GHCR resolution, bump commit,
deploy, rollback) verify in Batch 3 (needs the workflow on `develop`).
Result: Static validation complete; live verification deferred to Batch 3.

---

# Batch 3 — End-to-end CD test

- [ ] **3.1** Make a trivial, observable change to one component; merge to the deploy branch (or
  `workflow_dispatch` the CD since the trigger needs the default branch).
- [ ] **3.2** Watch: component CI builds `:<newSHA>` → `cd.yml` fires → **approval gate pauses** → approve →
  tag-bump commit lands → `deploy.sh --atomic` runs.
- [ ] **3.3** Confirm in-cluster: changed component rolled to `…:<newSHA>`; change live on its host;
  **unchanged components did NOT roll**.
- [ ] **3.4** Confirm `values-gjirafa.yaml` pins the new SHA for the changed component only.
- [ ] **3.5** **Rollback drill:** `git revert` the bump → CD redeploys prior image → component reverts.
- [ ] **3.6** **Negative test:** force a bad deploy (bad tag) → `--atomic` rolls back, health gate fails the
  job, Discord failure notice fires.

**GATE 3:** A change flowed CI → approval → bump → deploy → live, touching only the changed component;
revert-rollback and failure-rollback verified.
Result: _______

---

# Batch 4 — Batch 9 DOKS cleanup (safe; no running workload touched)

- [ ] **4.1** Delete `infrastructure/terraform/` (abandoned DOKS stack; never applied; DO account already deleted/revoked).
- [ ] **4.2** Delete `infrastructure/nginx/` (replaced by ingress-nginx + cert-manager).
- [ ] **4.3** Delete the **duplicate** `infrastructure/keycloak/realm-export.template.json` (keep the Helm copy).
- [ ] **4.4** Grep for dangling refs and fix:
  `grep -rn 'infrastructure/terraform\|infrastructure/nginx' . --include='*.md' --include='*.yml' --include='*.sh'`.
- [ ] **4.5** `helm lint` + `helm template … >/dev/null` still clean after deletions.

> The Batch 9 *vestigial Helm defaults* (`do-block-storage`→`longhorn`, `ClusterIssuer`→`Issuer`) were
> already done in the monitoring rollout — verify, don't redo. Frontend multi-env build args, DNS
> durability, and mailer are features/external asks (deferred follow-ups below), not cleanup.

**GATE 4:** DOKS/Terraform/nginx/dup-realm deleted; no dangling refs; chart still lints/templates clean.
Result: _______

---

# Batch 5 — Docs retirement + finalize

- [ ] **5.1** Retire/replace: `docs/operations/terraform.md` (→ short "why no Terraform" note or retire),
  `docs/operations/nginx-ssl.md` (retire), `infrastructure/keycloak/PRODUCTION.md` +
  `infrastructure/nginx/PRODUCTION.md` (retire; latter deleted in 4.2).
- [ ] **5.2** Update `docs/operations/ci-cd.md`: new CD (both branches → project-02, approval gate +
  `project-02` Environment, per-component tag bump, `--atomic` rollback, migration-hook guardrail,
  forward-only-schema caveat).
- [ ] **5.3** Update `docs/operations/deployment-roadmap.md`: mark **Batch 9** done; keep frontend
  multi-env, DNS durability, mailer as remaining follow-ups.
- [ ] **5.4** Populate empty `README.md` (structure + run/deploy); refresh `backend/CLAUDE.md`.
- [ ] **5.5** Final sweep: `git status` clean of deleted trees; all workflows lint; open/refresh the CD PR
  with filled-in gate "Result:" lines.

**GATE 5:** Superseded docs retired; ci-cd.md + roadmap updated; README populated; PR open with evidence.
Result: _______

---

## Rollback

- **In-flight failure:** `--atomic` rolls the release back to the prior revision; health gate fails the
  job; Discord notice fires. **Schema forward-only — verify DB manually.**
- **Bad deploy that passed gates:** `git revert` the bump on the deploy branch → CD redeploys prior image.
  Manual escape hatch: `helm rollback myproperty <REV>` (release ~rev 28 today).
- **Fresh-store provisioning is NEVER done by CD** — manual two-phase (`--no-hooks` then normal), due to
  the pre-upgrade migration hook.

## Risks & gotchas

1. **`cd.yml` must be on the default branch to fire** via `workflow_run` — confirm in 0.2; pre-merge test via `workflow_dispatch`.
2. **Branch protection blocks the bot push** (0.4) — the most likely blocker; resolve with App/PAT (then `[skip ci]`) or GITHUB_TOKEN.
3. **`workflow_run` fires once per CI workflow** — concurrency serializes; idempotent resolution converges. A few redundant runs is acceptable.
4. **Both branches → one namespace = last-deploy-wins**; develop/main `values-gjirafa.yaml` carry different pinned tags over time. Expected.
5. **`--atomic` + migration hook** — failed hook rolls workloads back but DB may be partly migrated (forward-only). Don't imply clean rollback.
6. **Never decode Secrets** in any debug step — length/hash only.
7. **Kuma seed `post-upgrade` hook runs every deploy** — its tag must resolve to an existing image (Batch 1 guarantees) or it ImagePullBackOffs each deploy.

## Deferred follow-ups (tracked, NOT in this branch)

- Frontend multi-env build args (`NEXT_PUBLIC_*` via `workflow_dispatch`).
- Provider durability — ask Gjirafa for a stable ingress entrypoint vs the 12 hardcoded worker A-records.
- Mailer (Mailpit / transactional relay); image signing (cosign) + admission; Trivy HIGH-blocking flip.
- **Realm-change auto-deploy** — Keycloak realm edits (`helm/myproperty/files/realm-export.template.json`)
  build no image, so they don't trigger this image-based CD; decide if they should deploy on a chart/values
  change too, or stay manual. (`realm-import-ci.yml` only smoke-tests the import; it doesn't deploy.)

## Critical files

- `.github/workflows/cd.yml` (new), `.github/workflows/uptime-kuma-init-ci.yml` (new)
- `helm/myproperty/values-gjirafa.yaml` (auto-bumped), `infrastructure/gjirafa/deploy.sh` (invoked `--atomic --cleanup-on-fail`)
- `infrastructure/terraform/`, `infrastructure/nginx/`, `infrastructure/keycloak/realm-export.template.json` (deleted)
- `docs/operations/{ci-cd,deployment-roadmap,terraform,nginx-ssl}.md`, `README.md`, `backend/CLAUDE.md`
- GitHub repo: Environment `project-02` (required reviewer + `KUBECONFIG_PROJECT_02`)
