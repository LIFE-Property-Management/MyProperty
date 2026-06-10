# Security model & threat model

The folder around this file is **evidence** — scan outputs from gitleaks, trufflehog, OWASP ZAP, and
Lighthouse ([`README.md`](./README.md), [`audit-m5.5.md`](./audit-m5.5.md)). This document is the
**model**: what we protect, where the trust boundaries are, how identity and access work, and what
the residual risks are. It is hand-derived from the running code and the architecture docs; where it
asserts a control, the source is named so it can be checked.

> Companion reading: [`architecture/context.md`](../architecture/context.md) /
> [`containers.md`](../architecture/containers.md) (trust boundaries), the
> [auth flow runbook](../operations/auth-flow.md), [`operations/security-hardening.md`](../operations/security-hardening.md)
> (M4.8 image + secret hardening), and [ADR-0001](../architecture/adr/0001-keycloak-over-custom-auth.md).

---

## 1. Assets & data classification

| Asset | Sensitivity | Where it lives | Primary protection |
|---|---|---|---|
| Tenant/landlord PII (email, name, phone) | High (GDPR) | Postgres `users`; Keycloak | TLS in transit; AuthZ; soft-delete; EU-region analytics |
| Payment records + receipt files | High | Postgres `payments`; receipts on a Longhorn PVC | Lease-scoped AuthZ; path-traversal-safe storage |
| Credentials (passwords, refresh tokens) | Critical | **Keycloak only** — never in the app DB | Keycloak; app never sees passwords post-provisioning |
| Invite tokens | Critical (grant lease access) | Email link only; DB stores **SHA-256 hash** | Hashing; 7-day expiry; anonymous-rate-limited |
| Service secrets (DB, RabbitMQ, OAuth, Anthropic, Discord) | Critical | K8s Secrets in `project-02` | Manual `secrets.sh`; not in git; random-generated |
| Audit trail (`CreatedBy`/`UpdatedBy` = Keycloak `sub`) | Medium | every table (`BaseEntity`) | Interceptor-set, never client-set |

---

## 2. Trust boundaries

```
   Internet  │  Cluster edge        │  In-namespace (project-02)            │  External SaaS
 ───────────┼──────────────────────┼───────────────────────────────────────┼────────────────
  Browser   │ ingress-nginx (TLS   │ frontend · API · Keycloak · Unleash   │ Anthropic
  (untrusted)│ terminates here)     │ Postgres · Redis · RabbitMQ · obs     │ Discord
            │                      │ (plain HTTP **inside** the cluster)   │ Let's Encrypt
```

- **Browser → edge** is the one boundary crossing untrusted ground: **HTTPS / TLS 1.2+** only. Inside
  the cluster, service-to-service traffic is plain HTTP — confidentiality there rests on the network
  boundary (NetworkPolicies, §6), not TLS.
- **No internal service is publicly addressable** except through the five ingress hosts. Unleash is
  ClusterIP-only (no ingress). The Hangfire dashboard and `/metrics` are reachable only via the API
  host and are Admin-gated / cluster-internal respectively.
- **External SaaS** calls leave over HTTPS and degrade gracefully if keys are absent (Anthropic OCR
  returns empty; Discord falls back to stdout) — a missing third-party never opens an auth hole.

---

## 3. Identity & authentication

- **Keycloak is the only identity authority** ([ADR-0001](../architecture/adr/0001-keycloak-over-custom-auth.md)).
  The app issues no tokens and stores no passwords. Browser login is **OIDC Authorization Code + PKCE
  (S256)** via `keycloak-js`; the access token lives in JS memory, never in a cookie or localStorage.
- **The API validates every JWT locally** against Keycloak's JWKS (fetched once, cached): signature,
  `iss` = the configured authority, `aud` must contain `myproperty-api`, and expiry. No per-request
  IdP round-trip. `DefaultInboundClaimTypeMap.Clear()` keeps claim names as-issued.
  *(`Program.cs` — `AddJwtBearer`.)*
- **Three gating layers, one real boundary** (see [auth-flow.md](../operations/auth-flow.md)):
  1. Edge middleware checks only the *presence* of a `kc_token` **sentinel cookie** (value
     `"kc.authenticated"`, **not** a JWT) — a UX redirect, not security.
  2. `KeycloakInit` (client) confirms the session — UX, not security.
  3. **API JWT signature validation** — the actual security boundary. A forged/stale cookie cannot
     reach data because layer 3 rejects any request without a valid, signed, unexpired token.

## 4. Authorization

- **Role-based:** Keycloak realm roles `Tenant` / `Landlord` / `Admin` → `RequireTenant` /
  `RequireLandlord` / `RequireAdmin` policies. The default fallback policy requires authentication
  (no accidental public endpoints).
- **Resource-scoped ownership** on top of the role gate: handlers re-load the aggregate and check
  ownership (`lease.LandlordId == caller`, `payment.Lease.TenantId == caller`, dual check on receipt
  download). A valid token for the wrong resource gets **403**, not data.
- **Privilege escalation is server-side only.** A browser cannot grant itself a role: role assignment
  happens through `KeycloakAdminClient` (client-credentials service account) during landlord
  registration and invite acceptance. The JWT only ever *reports* roles; it never sets them.
- **State transitions are server-enforced.** Payment/Invite guards live in the Application handlers
  (the entities are anemic); no client request can force `Confirmed` or `Accepted`. See the
  [state machines](../architecture/diagrams/state-payment.svg).

## 5. Secrets, tokens & credentials

- **Invite tokens:** 32 cryptographically-random bytes, URL-safe base64; the DB stores only the
  **SHA-256 hash** (`invites.TokenHash`, unique). The plaintext exists only in the email body and the
  Hangfire job arg — never in the DB, never in logs. A full DB dump yields no usable tokens. Tokens
  expire after 7 days and the preview/accept/reject endpoints are IP-rate-limited so the 200-vs-404
  distinction can't be used to enumerate valid tokens.
- **K8s Secrets** are created by `infrastructure/gjirafa/secrets.sh` — stable random passwords
  generated once (Postgres, RabbitMQ, Keycloak, Redis, Grafana, Unleash, API client) and operator
  values (GHCR, Google OAuth, Anthropic, Discord) read from an un-committed `.secrets.env`. **No
  External Secrets Operator** (cluster-scoped — unavailable on a borrowed namespace).
- **The sentinel cookie is not a credential** (§3): it carries no identity, only "a session may
  exist."

## 6. Network & runtime hardening

- **NetworkPolicies: default-deny + targeted allow**, enforced by **Calico** (on in prod). The data
  tier (Postgres/Redis/RabbitMQ) is locked to component selectors — only the API/Keycloak/Unleash
  pods that need them can connect.
- **Every workload image is non-root and digest-pinned** (`@sha256:`): backend on a **chiseled**
  Ubuntu base (UID 1654, no shell/package manager), frontend on **distroless** Node (pod
  `runAsUser: 1000`), AIOps as a dedicated non-root user, Unleash as UID 1000 with
  `automountServiceAccountToken: false`. A foothold has almost nothing to pivot with.
- **TLS** is issued by the cluster's shared cert-manager via a **namespaced** `Issuer` (HTTP-01),
  auto-renewed ~30 days before expiry.
- **Least privilege at the platform layer:** namespace-admin only (no cluster-scoped controllers),
  Promtail under a namespaced `Role` (no cluster-wide log read).

## 7. Input handling & abuse prevention

- **FluentValidation** on every command/query → 400 `ValidationProblemDetails`.
- **File uploads:** 6 MB hard cap (Kestrel → 413) + 5 MB business cap + MIME allowlist
  (`image/jpeg|png`, `application/pdf`) → 400; **path-traversal rejected** at storage-resolve time.
- **Rate limiting:** `anon-invite` 30/min/IP on public auth + invite endpoints; `authenticated`
  120/min/user elsewhere → 429.
- **Soft-delete global query filter** (`WHERE DeletedAt IS NULL`) is applied automatically to every
  query, so a forgetful handler can't read logically-deleted rows.

## 8. Supply chain & scanning (CI gates)

- **Trivy** scans every workload image twice per build — a non-blocking SARIF pass (CRITICAL+HIGH →
  GitHub Security tab) and a **blocking CRITICAL gate** (`ignore-unfixed`). **CycloneDX SBOM** per
  image (90-day retention). *(Caveat: the `myproperty-migrations` image rides `backend-ci` without
  its own Trivy/SBOM pass — see [`cicd.md`](../architecture/cicd.md).)*
- **Secret scanning** (`security-ci.yml`, blocking): gitleaks + git-secrets over the full history;
  trufflehog as a corroborating verified-credential sweep. **DAST:** OWASP ZAP baseline (scheduled).
  **Best-practices:** Lighthouse CI. **Dependabot** across .NET / npm / Docker / Actions.
- All scan outputs are committed in this folder and reproducible (see [`audit-m5.5.md`](./audit-m5.5.md) §A).

---

## 9. STRIDE summary

| Threat | Vector | Primary mitigation |
|---|---|---|
| **Spoofing** | Forged token / stolen cookie | JWKS signature + `iss`/`aud`/expiry validation; sentinel cookie is non-authoritative |
| **Tampering** | Modify another tenant's data; tamper in transit | Resource-scoped ownership (403); TLS at edge; interceptor-set audit fields |
| **Repudiation** | "I didn't do that" | `CreatedBy`/`UpdatedBy` audit trail + `CorrelationId` propagated through logs and Hangfire |
| **Information disclosure** | Read others' data; leak tokens/secrets | AuthZ; invite-token hashing; secrets in K8s Secrets; NetworkPolicies; soft-delete filter |
| **Denial of service** | Endpoint flooding; huge uploads | Rate limits (30/120); 6 MB upload cap; readiness gated only on Postgres so partial outages degrade, not crash |
| **Elevation of privilege** | Self-assign a role; force a state transition | Roles assigned **only** server-side via Keycloak Admin API; state guards in handlers |

---

## 10. Residual risks & known gaps

Tracked honestly; each is recorded elsewhere and most are scheduled.

| Risk | Status | Source |
|---|---|---|
| **Missing security response headers** (CSP, anti-clickjacking, `X-Content-Type-Options`, `Permissions-Policy`) + `X-Powered-By` disclosure | Open — the one substantive M5.5 finding (P1) | [`audit-m5.5.md`](./audit-m5.5.md) §3 (ZAP) |
| **Keycloak brute-force protection disabled** (`bruteForceProtected: false` in the realm template) — the `/token` endpoint is unthrottled | Open | `infrastructure/keycloak/realm-export.template.json` |
| **IDOR existence leak** — a foreign payment ID returns **403** (not 404), revealing that the ID is valid (no data leaks) | Open — deferred post-ZAP | [`audits/m3-m4-audit/multitenancy-readiness.md`](../audits/m3-m4-audit/multitenancy-readiness.md) |
| **Google/IdP first-login provisioning gap** — a social-login user lands without a portal role/`User` row | Open | `backend/CLAUDE.md`; [`process-flows.md`](../architecture/process-flows.md) Appendix B |
| **No formal multi-tenant query filter** — isolation is per-handler today (no list endpoints leak, but it's not global) | Designed, not built | [`multitenancy-readiness.md`](../audits/m3-m4-audit/multitenancy-readiness.md) |
| **Commit-then-publish race** on events (publish after DB commit, not transactional) | Accepted — consumers are idempotent; outbox is a follow-up | [`events.md`](../architecture/events.md) |
| **No queue-level dead-letter exchange** — consumer-side failures rely on Hangfire retry / `FailedEmails` | Accepted for current scope | [`events.md`](../architecture/events.md) |

---

## 11. Evidence & references

- Scan artifacts + reproduction: [`README.md`](./README.md), [`audit-m5.5.md`](./audit-m5.5.md)
- Image + secret hardening (M4.8): [`../operations/security-hardening.md`](../operations/security-hardening.md)
- Auth flow detail: [`../operations/auth-flow.md`](../operations/auth-flow.md)
- Keycloak production config: [`../operations/keycloak-prod-config.md`](../operations/keycloak-prod-config.md)
- Decisions: [ADR-0001 (Keycloak)](../architecture/adr/0001-keycloak-over-custom-auth.md) · [technology-decisions.md](../architecture/technology-decisions.md)
