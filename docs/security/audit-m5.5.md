# Security Audit Report (M5.5)

| | |
|---|---|
| **Deliverable** | M5.5 — Security audit report |
| **Owner** | DevOps Lead |
| **Date** | 2026-06-05 |
| **Scope** | Four pillars: **git-secrets scan**, **secrets-exposure check** (gitleaks + trufflehog), **OWASP ZAP** DAST baseline, **Lighthouse CI** security audits. Container-image CVE scanning is **out of scope** — it shipped at M4.8 (Trivy); see [§5](#5-covered-elsewhere-out-of-scope). |
| **Method** | **Real scans executed for this audit**, Docker-based, against the repo (working tree **+ full git history**) and the **locally-running compose stack**. The scans are now wired as **recurring CI gates** ([§6](#6-ci-gates-added-m55)). Report-only on production code/config: findings become prioritized recommendations — no application security *fixes* are implemented in this deliverable (consistent with the M5.4 framing). |

This audit covers the source-side, DAST, and web-best-practices security layer — the surface the M4.8 image-CVE gate (Trivy) does not reach. Every number below comes from a scan run on 2026-06-05; the raw artifacts are committed alongside this report (see [Appendix B](#b-committed-artifacts)) and every scan is reproducible from [Appendix A](#a-reproduction).

---

## Executive summary

| # | Area | Status | Headline | Priority |
|---|---|---|---|---|
| 1 | git-secrets scan | ✅ Clean | **0 findings** across working tree + 243-commit history; 5 AWS key patterns registered | — |
| 2 | Secrets exposure (gitleaks + trufflehog) | ✅ Clean | **0 verified secrets**, **0 real secrets committed**; every match is a triaged false positive (dev placeholders, generated build output, doc/benchmark examples, test fixtures) | P3 — allowlist now committed |
| 3 | OWASP ZAP DAST | 🟡 Hardening gaps | **0 High/Critical**; 2 Medium + 6 Low, **all missing security response headers** (CSP, anti-clickjacking, `X-Content-Type-Options`, `Permissions-Policy`, COOP/COEP/CORP) + `X-Powered-By` disclosure | **P1** (add a header policy) |
| 4 | Lighthouse security | ✅ Strong | **Best Practices 100/100**; HTTPS, console-errors, deprecations, inspector-issues all pass | P2 — CI gate now wired |

**Net:** the repository is clean of committed secrets (three independent scanners agree), and the frontend's client-side best-practices are strong. The **one substantive finding** is the absence of an explicit **security-response-header policy** (the same gap [M5.4 §2](../performance/audit-m5.4.md) flagged for caching) — ZAP catches it, and it is the P1 follow-up. Secret-scanning and Lighthouse are now **CI gates**; ZAP runs on a weekly schedule.

---

## 1. git-secrets scan

**Tool & method.** AWS Labs [`git-secrets`](https://github.com/awslabs/git-secrets) run in a container (no host install). The AWS provider patterns were registered (`git secrets --register-aws` → 5 rules: access-key id, secret-access-key, account-id, etc.), then both the working tree (`git secrets --scan`) and the **entire commit history** (`git secrets --scan-history`) were scanned.

**Result.** ✅ **0 findings** in both passes (exit 0). No AWS access keys, secret keys, or account IDs are present anywhere in the tree or history.

git-secrets is purpose-built for **AWS** credential shapes; the broader, multi-provider secret sweep is [§2](#2-secrets-exposure-check-gitleaks--trufflehog). Artifact: [`git-secrets-scan.txt`](./git-secrets-scan.txt).

---

## 2. Secrets exposure check (gitleaks + trufflehog)

Two complementary scanners over the working tree **and** full history: **gitleaks** (regex/entropy ruleset, broad provider coverage) and **trufflehog** (which additionally *verifies* candidate credentials against live endpoints).

### 2.1 gitleaks — `git` (history) + `dir` (working tree)

gitleaks **v8.30.1**, default ruleset, no allowlist on the first pass. Raw result: **5 findings in history** (243 commits scanned) / **8 in the working tree**. De-duplicated, they are three distinct false positives plus generated build output:

| Finding | Rule | What it actually is | Verdict |
|---|---|---|---|
| `backend/MyProperty.Tests/Unit/Validators/AcceptInviteValidatorTests.cs:11` | `generic-api-key` | A fake invite-token literal used as a unit-test fixture | False positive |
| `docs/performance/m3-sql-optimization/README.md:261,271` | `generic-api-key` | `EXPLAIN ANALYZE` query-plan output — `Index Cond: Token = '<hex>'` from the M3.4 invite-by-token benchmark | False positive |
| `frontend/.next/dev/*` (×5: `prerender-manifest.json`, `server-reference-manifest.json`, `.rscinfo`, a chunk) | `generic-api-key` | Next.js-generated `previewModeSigningKey` / `previewModeEncryptionKey` / RSC `encryptionKey` — randomized per build, **gitignored, never committed** | False positive |

On the audit checkout the 5 working-tree-only matches were all under `frontend/.next/` — the `dir` scan walks gitignored files, whereas the CI gate runs `git` on a clean checkout where `.next/` does not exist.

> **`dir`-mode caveat (environment-dependent).** Because `dir` reads gitignored files, its result depends on what untracked files happen to exist locally. On a developer machine that holds real local-only credentials — e.g. `infrastructure/gjirafa/.secrets.env` or a `*.kubeconfig` — the `dir` scan **will additionally flag those as genuine secrets**. That is expected and is **not** a leak: those files are gitignored and never committed, so the blocking CI gate (`git` mode, history only) never sees them. They are deliberately **not** allowlisted, so that a real secret force-committed into one of those paths would still be caught.

**Triage.** A [`.gitleaks.toml`](../../.gitleaks.toml) allowlist (repo root) records each false positive with a rationale — the same triage discipline as `.trivyignore` for CVEs (a *real* secret is never allowlisted; it is rotated and purged from history). **Post-allowlist re-scan = 0 findings** in `git` mode — the blocking CI gate — and 0 in `dir` mode on a clean checkout free of local secret-bearing files (see the `dir`-mode caveat above). Artifacts: [`gitleaks-pre-allowlist-history.json`](./gitleaks-pre-allowlist-history.json) (the triaged findings) and [`gitleaks-report.json`](./gitleaks-report.json) (clean, post-allowlist).

### 2.2 trufflehog — verified-credential sweep

trufflehog **3.95.5**, `git file:///repo` over history (242 commits, 4 668 chunks, `--results=verified,unknown`).

**Result.** ✅ **0 verified secrets.** 19 *unverified* candidates, all of the same class — **local-dev database connection strings** (`Host=…;Username=postgres;Password=postgres`) flagged by the Postgres/SQLServer detectors:

| Detector | File | Count |
|---|---|---:|
| SQLServer | `docs/performance/m3-redis-caching/bench/Program.cs` | 4 |
| SQLServer | `backend/MyProperty.Infrastructure/Persistence/AppDbContextFactory.cs` | 4 |
| Postgres | `infrastructure/uptime-kuma/monitors.json` | 3 |
| SQLServer | `docs/operations/migrations.md` | 2 |
| SQLServer | `docs/audits/m3-m4-audit/todo-inventory.md` | 2 |
| SQLServer | `docker-compose.yml` | 2 |
| SQLServer | `backend/MyProperty.Api/appsettings.Development.json` | 2 |

All point at `localhost`/in-compose hostnames with the `postgres/postgres` dev credential; **none verified** (no live secret). Artifact: [`trufflehog-report.jsonl`](./trufflehog-report.jsonl).

### 2.3 Manual review (corroborating)

The scanner results were sanity-checked against the obvious exposure vectors:

- **`.env` is untracked** and has **never** appeared in git history (`git log --all -- .env` → empty). Only `.env.example` / `.env.proxy.example` (placeholder values) are tracked.
- **Keycloak realm exports are `${VAR}`-templated** — `infrastructure/keycloak/realm-export.template.json` and the Helm copy use `${MYPROPERTY_API_CLIENT_SECRET}` / `${GOOGLE_CLIENT_SECRET}`, rendered at deploy time. No literal client secret is committed.
- **`docker-compose.yml` dev defaults** (`postgres/postgres`, Keycloak `admin123`, `dev-api-client-secret`, `unleash-insecure-*-token`, the n8n dev encryption key, `changeme-please-1234`) are **intentional local-dev placeholders**. Every one is overridden in deployed environments via the External Secrets Operator / K8s Secrets path (M4.8, [`security-hardening.md`](../operations/security-hardening.md)). They grant access to nothing beyond a developer's localhost stack.
- **`helm/myproperty/values.yaml` "secret" lines are ESO remote secret _names_** (e.g. `postgresPassword: myproperty-postgres-password`), not values — the literal is the key looked up in GCP Secret Manager / Azure Key Vault.

**Conclusion:** no real secret is committed to the repository or its history.

---

## 3. OWASP ZAP — DAST baseline

**Tool & method.** OWASP ZAP `stable`, `zap-baseline.py` (a **passive** scan: traditional spider + AJAX spider `-j` for the Next.js SPA — no active/attack payloads). Target: the **locally-running frontend** at `http://host.docker.internal:3000`, backed by the full compose stack (Postgres, Redis, RabbitMQ, Keycloak, Unleash, backend API). `NEXT_PUBLIC_DEV_AUTH_BYPASS=true` in the dev image let the spider crawl past the login wall into authenticated pages. The frontend is the user-facing surface scanned this run; the backend API/Swagger shares the same edge in production.

**Result.** 10 alert types, **0 High/Critical** (expected — baseline is passive):

| Risk | Alert | Instances | CWE |
|---|---|---:|---|
| **Medium** | Content Security Policy (CSP) header not set | 3 | 693 |
| **Medium** | Missing anti-clickjacking header (`X-Frame-Options` / CSP `frame-ancestors`) | 3 | 1021 |
| Low | `X-Content-Type-Options` header missing | 5 | 693 |
| Low | `Permissions-Policy` header not set | 5 | 693 |
| Low | Cross-Origin-Resource-Policy (CORP) header missing | 5 | 693 |
| Low | Cross-Origin-Embedder-Policy (COEP) header missing | 1 | 693 |
| Low | Cross-Origin-Opener-Policy (COOP) header missing | 1 | 693 |
| Low | Server leaks information via `X-Powered-By` | 3 | 497 |
| Info | Storable and Cacheable Content | 5 | 524 |
| Info | Non-Storable Content | 2 | 524 |

**Independent confirmation (`curl -I`).** The frontend returns only `X-Powered-By: Next.js` and `Cache-Control: s-maxage=31536000` — **no** CSP, `X-Frame-Options`, `X-Content-Type-Options`, `Permissions-Policy`, `Referrer-Policy`, or HSTS. The backend (`/swagger`) returns `Server: Kestrel` with no security headers. This matches ZAP exactly.

**Analysis.** There are no injection or active-exploit findings; the entire result set is **missing security-response-header hardening** plus framework/version disclosure. This is the predictable signature of an app with no explicit `headers()` policy — the same root cause [M5.4 §2](../performance/audit-m5.4.md) flagged on the caching axis. The `Storable and Cacheable Content` info alert is the long `s-maxage=31536000` on the landing HTML — worth confirming it is intended for a shared cache.

**Recommendation (P1).** Add an explicit security-header policy. Either layer works; doing it at the **shared ingress** covers both frontend and API at once:

- **Frontend** — `frontend/next.config.ts`: set `poweredByHeader: false` and add a `headers()` block; **and/or**
- **Edge** — inject at ingress-nginx / the compose nginx (`docs/operations/nginx-ssl.md`), which already fronts every service in production.

Concrete header set: `Content-Security-Policy` (start report-only, then enforce), `X-Frame-Options: DENY` (or CSP `frame-ancestors 'none'`), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (deny unused features), and `Strict-Transport-Security` (HTTPS/prod only — meaningless over the dev `http://localhost`). Drop `X-Powered-By`/`Server` disclosure. Artifacts: [`zap-frontend-report.html`](./zap-frontend-report.html) / [`.json`](./zap-frontend-report.json) / [`.md`](./zap-frontend-report.md).

---

## 4. Lighthouse — security audits + CI gate

**Tool & method.** Lighthouse **13.3.0** (default mobile emulation + throttling) against the local **production-mode** frontend container (`NODE_ENV=production`), page `/`.

### 4.1 Category scores

| Category | Score |
|---|---:|
| Performance | 96 |
| Accessibility | 96 |
| **Best Practices** | **100** |
| SEO | 91 |

### 4.2 Security-relevant audits

| Audit | Result | Note |
|---|---|---|
| `is-on-https` | ✅ pass | `localhost` is a secure context; production is HTTPS (ingress + Let's Encrypt, M4.9) |
| `errors-in-console` | ✅ pass | No browser console errors |
| `deprecations` | ✅ pass | No deprecated web platform APIs |
| `inspector-issues` | ✅ pass | No DevTools-surfaced issues |
| `csp-xss` | ℹ️ informational | Surfaces the **same CSP gap** as ZAP §3 — but **not scored** |
| `has-hsts` | ℹ️ informational | Not scored |
| `clickjacking-mitigation` | ℹ️ informational | Not scored |
| `no-vulnerable-libraries` | — | **Removed** in recent Lighthouse; dependency-vuln coverage is Dependabot + Trivy (§5) |

**Important nuance.** Best Practices = 100 does **not** mean the security headers are present. Lighthouse grades *client-side* best practices (HTTPS, console health, deprecated APIs, image aspect ratios) and treats CSP / HSTS / clickjacking as **informational** audits that don't affect the score. The missing-header findings come from **ZAP (§3)**. The two tools are **complementary**, not redundant — this audit runs both deliberately.

### 4.3 Lighthouse CI gate (new)

[`frontend/lighthouserc.json`](../../frontend/lighthouserc.json) wires `@lhci/cli` with assertions: `categories:best-practices ≥ 0.9` (**error**), `errors-in-console` / `deprecations` (**error**), `performance`/`accessibility`/`seo ≥ 0.9` and `is-on-https` (**warn**), three runs, results to temporary-public-storage. It runs in [`security-ci.yml`](../../.github/workflows/security-ci.yml) on frontend changes — **closing the "no Lighthouse CI gate" backlog item from [M5.4 §6](../performance/audit-m5.4.md)**, now from the security angle. Artifacts: [`lighthouse-security-home.report.html`](./lighthouse-security-home.report.html) / [`.json`](./lighthouse-security-home.report.json).

---

## 5. Covered elsewhere (out of scope)

These security controls already exist and are intentionally **not** re-audited here:

| Control | Where | Milestone |
|---|---|---|
| Container-image CVE scanning (two-pass Trivy gate, `.trivyignore`) | `backend-ci.yml` / `frontend-ci.yml`, [`security-hardening.md`](../operations/security-hardening.md) | M4.8 |
| Dependency CVE PRs (5 ecosystems) | `.github/dependabot.yml`, [`ci-cd.md`](../operations/ci-cd.md) | M4.3 |
| CycloneDX SBOM per image | image-build jobs | M4.8 |
| Runtime secret management (ESO + GCP/Azure) | Helm `external-secrets`, [`security-hardening.md`](../operations/security-hardening.md) | M4.8 |
| Network segmentation (default-deny NetworkPolicies) | Helm `networkpolicies` | M4.8 |
| Pod Security Standards (baseline → restricted path) | namespace labels | M4.8 |

---

## 6. CI gates added (M5.5)

[`.github/workflows/security-ci.yml`](../../.github/workflows/security-ci.yml) — three jobs:

| Job | Triggers | What it does |
|---|---|---|
| `secret-scan` | every PR + push to `develop`/`main` + weekly `schedule` | gitleaks (`git`, full history, honors `.gitleaks.toml`, **blocking** + SARIF → Security tab) **and** git-secrets (`--register-aws` + `--scan-history`) |
| `lighthouse-ci` | frontend changes + `workflow_dispatch`/`schedule` | `npm run build` → `lhci autorun` (asserts per `lighthouserc.json`); uploads reports |
| `zap-baseline` | weekly `schedule` + `workflow_dispatch` | boots the compose stack (fresh CI volume → `init.sql` seeds DBs), runs the ZAP passive baseline, uploads the report. **Off the PR path** so PRs stay fast |

Plus [`.gitleaks.toml`](../../.gitleaks.toml) (triaged allowlist + triage policy) and the `@lhci/cli` dev-dependency + `lhci` script in `frontend/package.json`.

---

## 7. Recommendations summary

| Priority | Area | Action | Effort |
|---|---|---|---|
| **P1** | DAST / headers | Add a security-response-header policy (CSP, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, HSTS) + `poweredByHeader: false`; apply at the frontend + backend, or once at the shared ingress | S–M |
| **P2** | git-secrets | Add repo-specific custom patterns beyond AWS — Anthropic (`sk-ant-…`), Slack/Discord webhook URLs — so a leaked project key is caught by shape, not just entropy | S |
| P2 | Lighthouse | ✅ Done — CI gate wired; monitor Best-Practices + console-errors over time | — |
| P3 | Secrets | ✅ Done — `.gitleaks.toml` allowlist committed; the dev placeholders are non-secrets (no rotation needed) | — |
| Backlog | DAST | Promote ZAP from passive baseline to an **authenticated active scan** against a staging deploy (full attack rules), tracked as a scheduled job | M |
| Backlog | Caching | Confirm the `s-maxage=31536000` on landing HTML is intended for shared caches (ties into M5.4 §2's caching follow-up) | S |

---

## Appendix

### A. Reproduction

All scanners run via Docker (none installed on the host). On Windows Git-Bash, prefix mounts with `MSYS_NO_PATHCONV=1` so container paths aren't mangled.

```bash
# 1. git-secrets (AWS patterns, tree + history)
docker run --rm --entrypoint sh -v "$PWD:/repo" -w /repo alpine/git -c '
  apk add --no-cache bash make >/dev/null; \
  git clone -q https://github.com/awslabs/git-secrets /tmp/gs; make -C /tmp/gs install >/dev/null; \
  git config --global --add safe.directory /repo; git secrets --register-aws; \
  git secrets --scan; git secrets --scan-history'

# 2a. gitleaks — history + working tree (honors .gitleaks.toml)
# NOTE: `dir` reads gitignored files, so on a machine holding real local-only
# secrets (e.g. infrastructure/gjirafa/.secrets.env, *.kubeconfig) it will flag
# those genuine credentials. That is expected — they are untracked/never
# committed, so the `git`-mode gate below (what CI runs) does not see them.
docker run --rm -v "$PWD:/repo" ghcr.io/gitleaks/gitleaks:v8.30.1 git /repo -c /repo/.gitleaks.toml --redact
docker run --rm -v "$PWD:/repo" ghcr.io/gitleaks/gitleaks:v8.30.1 dir /repo -c /repo/.gitleaks.toml --redact

# 2b. trufflehog — verified + unknown over history
docker run --rm -v "$PWD:/repo" trufflesecurity/trufflehog:latest git file:///repo --results=verified,unknown --json

# 3. OWASP ZAP baseline (app must be up: docker compose up -d frontend)
docker run --rm -v "$PWD/docs/security:/zap/wrk:rw" ghcr.io/zaproxy/zaproxy:stable \
  zap-baseline.py -t http://host.docker.internal:3000 -j \
  -r zap-frontend-report.html -J zap-frontend-report.json -w zap-frontend-report.md

# 4. Lighthouse (app must be up)
CHROME_PATH="/path/to/chrome" npx --yes lighthouse@latest http://localhost:3000/ \
  --only-categories=best-practices,performance,seo,accessibility \
  --output=json --output=html --output-path=docs/security/lighthouse-security-home
```

> **Local-env notes (not bugs):** (1) bringing up the stack on a **long-lived** dev machine surfaced a pre-M5.6 Postgres volume missing the `unleash` database — `docker compose exec postgres psql -U postgres -c "CREATE DATABASE unleash;"` then re-`up`. CI uses a **fresh** volume where `infrastructure/postgres/init.sql` seeds it automatically. (2) Lighthouse on Windows prints a cosmetic `EPERM` while deleting its Chrome temp dir **after** writing the reports — the reports are valid.

### B. Committed artifacts

| File | Scan |
|---|---|
| `git-secrets-scan.txt` | git-secrets (tree + history) |
| `gitleaks-report.json` | gitleaks post-allowlist (clean) |
| `gitleaks-pre-allowlist-history.json` | gitleaks raw history findings (the triaged false positives) |
| `trufflehog-report.jsonl` | trufflehog (0 verified / 19 unverified) |
| `zap-frontend-report.{html,json,md}` | OWASP ZAP baseline |
| `lighthouse-security-home.report.{html,json}` | Lighthouse 13.3.0 |

### C. Cross-references

- M4.8 image hardening / Trivy / ESO / NetworkPolicies: [`docs/operations/security-hardening.md`](../operations/security-hardening.md)
- CI/CD pipeline + Dependabot + Trivy details: [`docs/operations/ci-cd.md`](../operations/ci-cd.md)
- M5.4 performance audit (caching/header root cause, Lighthouse-CI backlog item): [`docs/performance/audit-m5.4.md`](../performance/audit-m5.4.md)
- nginx + Let's Encrypt edge (where prod header injection would live): [`docs/operations/nginx-ssl.md`](../operations/nginx-ssl.md)
- gitleaks triage allowlist: [`.gitleaks.toml`](../../.gitleaks.toml)
