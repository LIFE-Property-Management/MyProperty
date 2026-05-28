# ADR-0001: Keycloak over Auth0 / custom JWT

- **Status:** Accepted (M3.2, 2026-Q1)
- **Deciders:** Full Team
- **Reflected in:** [`containers.md`](../containers.md), [`components.md`](../components.md), [`deployment-prod.md`](../deployment-prod.md)

## Context

M3.2 mandates **OIDC + OAuth2 SSO + RBAC with 3+ roles**, with every endpoint protected. We need: federated identity, JWT issuance + validation, per-user role assignment, social IdP (Google), invite-flow integration (post-acceptance Keycloak account creation), an admin UI for non-engineers, and password reset emails. The student-demo budget excludes per-MAU pricing.

## Decision

Adopt **Keycloak 26.2** (Quarkus distribution) as the self-hosted Identity Provider for both dev (Docker Compose) and prod (Helm Deployment in DOKS). PostgreSQL is the JDBC-backed datastore — same instance as the app schema. Google Identity Provider federation enabled at realm import time. The .NET API consumes JWTs via `Microsoft.AspNetCore.Authentication.JwtBearer` against Keycloak's JWKS endpoint.

Realm configuration is **version-controlled** via [`infrastructure/keycloak/realm-export.template.json`](../../../infrastructure/keycloak/realm-export.template.json), rendered at deploy time by an `envsubst` init container (dev) or `keycloak-realm-configmap` (prod).

## Consequences

### Positive

- **Zero per-MAU cost.** The bill is the Postgres rows and the container CPU/RAM.
- **Built-in:** user federation, password reset, social IdPs, sessions, refresh-token rotation, admin console.
- **Realm-as-config:** the canonical realm definition lives in the repo; rebuilding the cluster gives identical roles/clients/flows.
- **Quarkus distribution boots in ~10 s** (vs WildFly's ~60 s) — fast enough that the dev stack's healthcheck loop is acceptable.
- **The integration test fixture uses a real Keycloak Testcontainer** (M3.11), so we're testing what we deploy.

### Negative

- **Another stateful service to operate**: Pod, Deployment, Ingress, cert, Postgres schema. One more failure surface.
- **Keycloak 26's UBI Micro base ships no curl/bash** — the docker-compose `healthcheck` needs an inline Java HTTP probe (compiles `/tmp/HealthCheck.java` on first run) to test the realm's well-known endpoint.
- **Realm changes require an import volume sync.** A live realm edit via the admin UI must be re-exported to the template, or the next deploy resets it.

### Mitigations

- **Identical config in dev and prod** via the `realm-export.template.json` + `envsubst` pattern (`MYPROPERTY_FRONTEND_BASE_URL` substituted on the way in).
- **Keycloak admin client follow-up.** Currently only seeded users carry the Tenant role. Fresh users via the invite flow need an admin-client call to assign roles; tracked as a post-M3 follow-up in `backend/CLAUDE.md`.

## Alternatives considered

### Auth0 / Okta — rejected

- Per-MAU pricing is prohibitive for a multi-week demo where tenant accounts persist indefinitely.
- Vendor lock-in around proprietary rules engines / actions.
- Doesn't match the "self-hosted prod stack" pedagogical goal of the project.

### Custom JWT + ASP.NET Identity — rejected

- Would re-implement: federated identity (Google), password-reset emails, refresh-token rotation, admin UI, role-management API, social-login callback handling, JWKS rotation.
- Estimated effort dwarfs the M3.2 budget; the result is strictly worse than Keycloak in security maturity.

### Firebase Authentication — rejected

- GCP lock-in for an otherwise DigitalOcean-hosted stack.
- No fine-grained role-based access control out of the box.
- No admin console intended for non-engineering operators.
