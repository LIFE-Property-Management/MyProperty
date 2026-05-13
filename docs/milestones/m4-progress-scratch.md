# M4 progress — scratch log

Accumulating raw progress entries during the M4 unblock sprint and main M4 deliverables. Final `docs/m4-infrastructure-mvp.md` is assembled from this file when the milestone ships on May 22.

---

## Sprint plan of record — M4 unblock sprint

**Window.** May 13 → ~May 15. Two to three days. Closes before M4 main deliverables begin.

**Why this sprint exists.** Most "M4 blockers" in `docs/audits/m3-m4/audit/dev-prod-gaps.md` are application-code changes, not DevOps work. If the application code is not fixed first, the DevOps teammate starts building Docker Compose / Dockerfiles / Helm / CI-CD against an app that produces CORS errors, redirect loops, missing env vars, and Keycloak auth failures the moment containers come up on separate origins. That is a guaranteed stall. This sprint runs ahead of the DevOps work to remove those failures, so the DevOps teammate begins against an app that already behaves correctly in a multi-origin, reverse-proxied, container-deployed setup.

**Scope — 9 items from `docs/audits/m3-m4-audit/dev-prod-gaps.md`.**

| Group | Items | Owner | Status at sprint start |
|---|---|---|---|
| Origin & routing (backend) | C1, H7, A1 backend | Erdi | Open |
| Frontend build-time config | F1, F2, A2 (`.dockerignore`) | Erdi | Open |
| Realm config | A6, E5 (decision-only this sprint) | Erdi + DevOps | A6 done; A1 realm done; E5 decision pending |
| K8s readiness | H1 (readiness probe) | Erdi | Open |
| Migration bundle | D2 | Erdi (artifact); DevOps (K8s wiring) | Open |

Detail per item — fix shape, risk, and dependencies — lives in `docs/audits/dev-prod-gaps.md`. This file is the execution log, not the spec.

**Out of scope.** Anything not in the 9 items above. In particular: Anthropic OCR retry hardening (H2), RabbitMQ correlation ID propagation (L3), Redis fallback strategy (H4), brute-force protection (A4), Postgres pool tuning (D3), rate-limit boundary tests (C2), multi-tenancy retrofit, OWASP ZAP findings, IDOR existence leak. All deferred to M4 main work or M5.

**Sprint exit criteria — verification gate.** When all 9 items are closed, a multi-container `docker compose up` succeeds and a browser at `http://localhost:3000` can:
1. Reach `http://localhost:5042/api/v1/health` without CORS errors.
2. Initiate Keycloak login without redirect URI rejection.
3. Complete a JWT-authenticated API call end-to-end.
4. Have no `.env.local` content baked into the frontend production image.

When all four pass, message DevOps teammate that app-code blockers are cleared and M4 main deliverables are green-lit.

**Decisions already made (do not re-litigate during the sprint).**
- Loki + Grafana stays. No migration to ELK. Will document the deviation in the M5 architecture doc.
- Multi-tenancy work is deferred to M5. Global-query-filter retrofit during M4 risks breaking the Docker / Helm / CI work.
- OCR table extraction (`PaymentReceiptOcr`) deferred to M5, batched with multi-tenancy migration.
- IDOR existence leak (foreign payment ID → 403 instead of 404) deferred to M5 — fixing it after the OWASP ZAP scan produces a better paper trail.
- CI/CD scope is lint → test → build → push. "Deploy via pipeline" is out of scope; manual `helm upgrade` for the demo is acceptable.
- K8s deployment target is the real cluster provided by Gjirafa. No local kind / k3d / minikube.
- Linear stays as the project board.

**Order of execution within the sprint.**
1. **Plan 1 — backend origin & routing** (C1, H7, A1 backend). Most likely to surface unknowns; ships first. *Completed 2026-05-13.*
2. **Plan 2 — frontend build-time config** (F1, F2, A2). One decision (Docker build-arg injection for `NEXT_PUBLIC_*`) executed twice plus a static `.dockerignore` file.
3. **Plan 3 — realm + decision items** (A6 verification, E5 decision). A6 is already shipped on this branch; E5 is a documented decision for DevOps teammate, no code.
4. **Plan 4 — K8s readiness** (H1).
5. **Plan 5 — migration bundle artifact** (D2 artifact; K8s integration is DevOps teammate's M4 work).

Each plan is scoped to be reviewable as a single commit and verifiable against a concrete curl / build / test command.

---

### 2026-05-13 — M4 unblock sprint, Plan 2 (F1, F2, A2)

**Scope.** Frontend build-time config for Docker deployment + Docker build context hygiene.

**Changes.**
- `frontend/lib/utils/env.ts` (new) — `requirePublicEnv()` helper using a typed lookup-table of literal `process.env.NEXT_PUBLIC_*` reads (turbopack/webpack only inline literal property accesses; dynamic `process.env[name]` defeats static analysis). Throws in production builds when a required var is missing; warns in dev.
- `frontend/lib/api/client.ts` — replaced silent `process.env` fallback with `requirePublicEnv("NEXT_PUBLIC_API_BASE_URL")`. Updated comment to reflect prod-fatal behavior.
- `frontend/lib/auth/keycloak.ts` — replaced three `process.env.NEXT_PUBLIC_*!` non-null assertions in `getInstance()` with `requirePublicEnv()` calls.
- `frontend/.env.local.example` — added build-time vs runtime header, prod-shape placeholder URLs (`*.myproperty.PLACEHOLDER.example`), documented `NEXT_PUBLIC_API_BASE_URL` as dev-optional / prod-required.
- `frontend/.dockerignore` (new) — excludes `.env*` (critically `.env.local` containing `NEXT_PUBLIC_DEV_AUTH_BYPASS=true`), `node_modules`, `.next`, test dirs, IDE configs. Does **not** exclude `mocks/` or `public/mockServiceWorker.js` because both tenant and dashboard layouts unconditionally import `@/mocks/MockProvider` (audit item F3); MSW remains a no-op in prod via the `NODE_ENV !== "development"` check inside `MockProvider`. Cleaner stripping deferred post-M4.
- `backend/.dockerignore` (new) — excludes `bin/`, `obj/`, test project, `appsettings.Development.json`, IDE configs, `.env*`.
- `frontend/Dockerfile` (new) — verification-grade multi-stage build. Header explicitly marks it as not production-ready; DevOps owner hardens (standalone output, non-root user, healthcheck, base image pinning) before deployment.

**Verification.**
- `npx tsc --noEmit` clean.
- Docker build with `--build-arg NEXT_PUBLIC_API_BASE_URL=https://api.verify-test.example` succeeded. Bundle grep returned matches in three chunk files showing the URL inlined as a string literal: `NEXT_PUBLIC_API_BASE_URL:()=>"https://api.verify-test.example"`. Same for `NEXT_PUBLIC_KEYCLOAK_URL`. Confirms turbopack static replacement is reaching the client bundle.
- Docker build WITHOUT build args failed during Next.js prerender of `/tenant/dashboard` with the exact `requirePublicEnv` error message — confirms the runtime guard works as defense-in-depth at SSG time.
- First verification pass exposed a bug in the original `requirePublicEnv` implementation: dynamic `process.env[name]` access defeats Next.js's static replacement and leaves the var as an undefined runtime lookup in the client bundle. Restructured the helper to use a lookup table of literal accesses; re-verified.

**Side note — npm audit fix.** Bumped axios, next.js, and postcss inside the same working branch to close 13 high-severity axios CVEs, 14 high-severity Next.js advisories, and 1 moderate postcss issue. `npm audit` now reports 0 vulnerabilities. Next.js bumped from 16.2.3 to 16.2.6 (unrelated to the env-inlining issue, which is intentional bundler behavior not a regression).

**M3 grade impact.** None directly — these were M4 prep items. Removes the silent-failure mode that would have made any first Docker deploy land with broken API calls + Keycloak. Also closes a likely M5 security finding (axios CVEs).

**Sprint progress.** 6 of 9 M4 blockers closed (Plan 1: C1, H7, A1 backend; Plan 2: F1, F2, A2).

---