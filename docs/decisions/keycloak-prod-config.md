# Decision: Keycloak production configuration

**Author:** Erdi
**Date:** 2026-05-12
**Status:** Accepted; awaiting confirmation of items in "Open questions"
**Applies to:** M4 (Infrastructure & DevOps)
**Audience:** DevOps teammate writing Helm values / production Docker Compose
**Linked items:** dev→prod gaps audit § E5, A1, A6; todo-inventory.md M4 blockers

---

## Scope

This document specifies how Keycloak should be deployed to the Gjirafa-provided
Kubernetes cluster as part of M4. There is **no live demo for M4** — this
configuration must be correct for CI/CD and integration purposes; user-facing
flows beyond Keycloak username/password login can wait until M5.

The local development stack (`docker-compose.yml`) continues to use `start-dev`
mode. This document does not change dev behaviour.

---

## Decision

### Keycloak startup command

**Production mode**, with realm imported at startup: start --import-realm
Do **not** use `start-dev` in any deployed environment. `start-dev` disables
hostname validation and origin checks (Keycloak documents this as dev-only). A
grader running OWASP ZAP against a `start-dev` Keycloak will surface findings
that don't reflect the real production posture.

### Required environment variables

The version we deploy is **Keycloak 26.2.5** (matches `realm-export.json`'s
`keycloakVersion`).

| Variable | Value | Why |
|---|---|---|
| `KC_PROXY_HEADERS` | `xforwarded` | Tells Keycloak to parse `X-Forwarded-*` headers from Nginx. Without this, Keycloak returns **HTTP 403 Forbidden** on origin checks for any request that arrives via a reverse proxy. This is the silent killer of production Keycloak deployments. |
| `KC_HOSTNAME` | `https://auth.<prod-domain>` (full URL, https) | The public URL users will reach Keycloak at. Keycloak uses this to construct redirect URLs, issuer claims, and token URLs. Must be a full URL including scheme; `auth.<prod-domain>` alone is not enough. |
| `KC_HTTP_ENABLED` | `true` | TLS terminates at Nginx. Plain HTTP between Nginx and the Keycloak pod inside the cluster. |
| `KC_HOSTNAME_STRICT` | `true` (default — do not override) | Enforces that `KC_HOSTNAME` matches incoming requests. The `false` shortcut you'll see in dev tutorials is a security regression. |
| `KEYCLOAK_ADMIN` / `KEYCLOAK_ADMIN_PASSWORD` | From K8s secret, **not hardcoded** | Audit item S2. Current `docker-compose.yml` has `admin / admin123` in cleartext; this must not survive into Helm values. |
| `KC_DB_URL` / `KC_DB_USERNAME` / `KC_DB_PASSWORD` | From K8s secret | Audit item S1. Postgres credentials for Keycloak. |

### Deprecated — do not use

`KC_PROXY=edge` is deprecated as of Keycloak 24 and will be removed. The
modern equivalent is `KC_PROXY_HEADERS=xforwarded` plus `KC_HTTP_ENABLED=true`.

### Ports

Expose only **8080** through Nginx. Do **not** proxy **9000** — this is
Keycloak's health/metrics port and exposing it externally leaks internal state.

### Realm import

`realm-export.json` is mounted into the Keycloak container at
`/opt/keycloak/data/import/realm-export.json`. The `--import-realm` flag
triggers import on first start.

Notes on the export file:

- The Google IdP `clientSecret` is `**********` (redacted by Keycloak on
  export). After re-import in prod, **Google SSO will be non-functional** until
  the secret is provided. See deferred decisions below.
- The realm contains seeded test users only via the M3.11 integration test
  fixture, not via `realm-export.json`. The prod realm starts with no users.
- `sslRequired: "external"` is correct as-is — it requires HTTPS for external
  requests but allows HTTP from localhost/private networks, which is what we
  need behind Nginx.

---

## Deferred decisions

These were considered for this milestone and explicitly deferred:

### Google SSO in prod — deferred to M5

The Google IdP's `clientSecret` is redacted in `realm-export.json` and there is
no demo for M4. Three options were considered:

1. Manually set the secret via Keycloak admin UI after first start.
   **Rejected** — operationally painful, easy to forget, not reproducible.

2. Inject via env var / post-import `kcadm.sh` script.
   **Deferred to M5** — correct long-term solution but adds complexity to M4's
   already-large surface.

3. Disable Google SSO in prod for M4.
   **Accepted for M4** — no demo, no user impact. Document as known gap.

Users authenticate via Keycloak username/password in prod for M4. Google SSO
continues to work in dev (real secret in user-secrets).

### Brute-force protection — deferred to M5

`realm-export.json` has `bruteForceProtected: false` (audit A4). This is fine
in dev; it should be `true` in prod, but it's not blocking M4 deployment and
the M5 security pass is the right place to enable + tune it.

---

## Open questions to confirm with Gjirafa

DevOps teammate: when you start, please confirm these with Gjirafa and
update this doc.

1. **Cluster ingress**: does Gjirafa provide a managed Nginx/ingress in the
   cluster, or are we expected to ship our own ingress chart? This document
   assumes we're behind *some* Nginx-equivalent that does TLS termination; if
   the answer is "you write the ingress," scope expands.

2. **Hostname structure**: is `auth.<prod-domain>` available, or are we
   constrained to a single hostname with path-based routing (`/auth/`)? This
   doc assumes separate hostname; if path-based, `KC_HOSTNAME` and the
   `--hostname-path` option both change.

3. **DNS for the prod URL**: what's the actual domain we'll be reachable at?
   Affects A6 redirect URIs in `realm-export.json` (currently
   `https://myproperty.PLACEHOLDER.example` placeholder).

---

## Verification

After Keycloak is deployed in prod:

1. `curl https://auth.<prod-domain>/realms/MyProperty/.well-known/openid-configuration`
   returns a valid JSON document with all URLs using `https://auth.<prod-domain>`
   (not the internal pod URL). If you see internal URLs, `KC_HOSTNAME` is
   misconfigured.

2. Logging in via `myproperty-frontend` redirects back successfully (this also
   verifies A6 prod URL was added to `redirectUris`).

3. Decoding the resulting access token shows `aud` containing `"myproperty-api"`
   (this also verifies A1 worked).

4. No `403 Forbidden` errors in Keycloak logs on requests routed through Nginx.
   If present, `KC_PROXY_HEADERS` is missing or wrong.

---

## References

- Keycloak 26.2 reverse proxy docs: https://www.keycloak.org/server/reverseproxy
- Keycloak 26.2 hostname (v2): https://www.keycloak.org/server/hostname
- Audit § E5, A1, A6: `docs/audits/dev-prod-gaps.md`