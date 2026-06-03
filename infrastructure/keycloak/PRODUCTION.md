# Keycloak — production deployment notes

> ⚠️ **SUPERSEDED (DOKS-era bootstrap).** Keycloak now runs in-cluster via the Helm chart on
> Hetzner (namespace `project-02`); the realm config details here may still be useful but the
> deployment/bootstrap steps are obsolete. Current deploy:
> [../../docs/operations/k8s-deployment.md](../../docs/operations/k8s-deployment.md); current
> auth flow: [../../docs/operations/auth-flow.md](../../docs/operations/auth-flow.md).
> Note `infrastructure/keycloak/realm-export.template.json` is the source the **docker-compose**
> `keycloak-realm-init` service renders (envsubst → import volume); `helm/myproperty/files/` holds
> the K8s copy. They are byte-identical today but serve two different stacks, so the compose copy
> is **kept** (deleting it breaks `docker compose up`). See
> [../../docs/operations/deployment-roadmap.md](../../docs/operations/deployment-roadmap.md).

This document describes how the MyProperty Keycloak realm runs in
production-grade environments (staging, production). It complements
`docker-compose.yml`, which uses `start-dev` mode and is **dev-only**.

## TL;DR for the DevOps engineer

In production:
- Run Keycloak with `start --import-realm` (not `start-dev`).
- Set the env vars listed in [§ Required env vars](#required-env-vars).
- Replace the dev `keycloak-realm-init` compose service with a Kubernetes
  `initContainer` doing the same `envsubst` step (see § [Realm templating](#realm-templating)).
- Use the same public URL for `KC_HOSTNAME`, `NEXT_PUBLIC_KEYCLOAK_URL`, and
  the backend's `Keycloak__Authority` (see § [URL conventions](#url-conventions)).
- Source admin credentials and DB passwords from Kubernetes Secrets — not
  literal env values in the Helm chart.

---

## Why `start-dev` is dev-only

The compose file uses `command: ["start-dev", "--import-realm"]`. Keycloak's
`start-dev` mode disables:

- hostname validation (`KC_HOSTNAME_STRICT=false` implicitly),
- HTTPS enforcement,
- strict client and CORS checks,

…and is explicitly documented by Keycloak as unsuitable for any deployed
environment: <https://www.keycloak.org/server/configuration-production>.

Production must use `start --import-realm` instead. This is a one-line change
to the container command in the Helm values.

---

## Required env vars

For Keycloak 26.x running behind an Nginx ingress that terminates TLS
(the M4 architecture), the production-mode env vars are:

| Variable | Value | Why |
|---|---|---|
| `KC_HOSTNAME` | `https://<public-keycloak-url>` (e.g. `https://myproperty.PLACEHOLDER.example`) | The public-facing URL. Required in prod mode. Stamped into the JWT `iss` claim. |
| `KC_PROXY_HEADERS` | `xforwarded` | Honors `X-Forwarded-*` headers from the ingress. Replaces deprecated `KC_PROXY=edge`. |
| `KC_HTTP_ENABLED` | `true` | Required when TLS terminates at the ingress; the Keycloak pod itself serves plain HTTP. |
| `KC_HOSTNAME_STRICT` | `true` | Default in prod mode; explicit for clarity. |
| `KC_DB` | `postgres` | Same as dev. |
| `KC_DB_URL` | `jdbc:postgresql://<postgres-host>:5432/keycloak` | Cluster-internal Postgres service URL. |
| `KC_DB_USERNAME` | from K8s Secret | |
| `KC_DB_PASSWORD` | from K8s Secret | |
| `KEYCLOAK_ADMIN` | from K8s Secret | Admin bootstrap username. |
| `KEYCLOAK_ADMIN_PASSWORD` | from K8s Secret | Admin bootstrap password. |
| `GOOGLE_CLIENT_ID` | from K8s Secret | Google IdP federation. |
| `GOOGLE_CLIENT_SECRET` | from K8s Secret | Google IdP federation. |
| `MYPROPERTY_FRONTEND_BASE_URL` | `https://<public-frontend-url>` | Substituted into the realm template at import time (see [§ Realm templating](#realm-templating)). |

**Do not use the `${VAR:-default}` syntax for these in production.** The
compose file uses defaults so developers can run `docker compose up` without
any setup; production must fail fast on missing config rather than silently
fall back to a dev value. Set every variable explicitly.

---

## URL conventions

Keycloak ends up with two URL "identities" in production:

**Public URL** — e.g. `https://myproperty.PLACEHOLDER.example` (replace with
the real production domain, TBD from Gjirafa). This is the URL **browsers**
use to reach Keycloak for OAuth redirects, and the URL Keycloak stamps into
the JWT `iss` (issuer) claim.

- Set as `KC_HOSTNAME` on the Keycloak pod.
- Set as `NEXT_PUBLIC_KEYCLOAK_URL` in the frontend build (consumed by the
  Keycloak JS adapter for the auth redirect).
- Set as `Keycloak__Authority=<public URL>/realms/MyProperty` on the .NET
  API. **Must be the public URL** for the issuer claim in inbound JWTs to
  match what the API validates against.

**Cluster-internal URL** — e.g. `http://keycloak.auth.svc.cluster.local:8080`.
The .NET API discovers Keycloak's JWKS at startup; this traffic *could*
stay inside the cluster.

**Recommended:** use the public URL for both frontend and backend. Using the
cluster-internal URL for `Keycloak__Authority` creates an issuer-vs-authority
mismatch and all tokens get rejected — unless you also override
`MetadataAddress` in the JWT bearer options to decouple the two, which is
extra config to maintain. Save the optimization until there's a reason for it.

**Bottom line:** in the absence of advanced configuration, set `KC_HOSTNAME`,
`NEXT_PUBLIC_KEYCLOAK_URL`, and `Keycloak__Authority` all to the **same
public URL**.

---

## Realm templating

The committed realm config lives at
`infrastructure/keycloak/realm-export.template.json`. It contains the
placeholder `${MYPROPERTY_FRONTEND_BASE_URL}` in two spots inside the
`myproperty-frontend` client (`redirectUris` and `webOrigins`).

**Dev (docker-compose):** the `keycloak-realm-init` service runs once before
Keycloak starts. It mounts the template directory and a writable named volume,
runs `envsubst` to substitute the env var, and writes the result to
`/import/realm-export.json` in the named volume. Keycloak then mounts the
same named volume read-only at `/opt/keycloak/data/import/` and finds the
rendered file there at startup.

**Production (Kubernetes):** the same pattern translates directly:

1. Mount `realm-export.template.json` from a ConfigMap at `/template/`.
2. Run an `initContainer` (alpine + gettext) executing
   `envsubst < /template/realm-export.template.json > /import/realm-export.json`.
3. Mount an `emptyDir` volume at both `/import` on the initContainer and
   `/opt/keycloak/data/import/` on the main container.
4. Set `MYPROPERTY_FRONTEND_BASE_URL` on the initContainer's env from a
   ConfigMap or Secret.

Example Helm values shape (illustrative — adapt to whichever Helm chart you choose):

```yaml
initContainers:
  - name: realm-render
    image: alpine:3.20
    command:
      - sh
      - -c
      - apk add --no-cache gettext > /dev/null && envsubst < /template/realm-export.template.json > /import/realm-export.json
    env:
      - name: MYPROPERTY_FRONTEND_BASE_URL
        valueFrom:
          configMapKeyRef:
            name: keycloak-config
            key: frontendBaseUrl
    volumeMounts:
      - name: realm-template
        mountPath: /template
      - name: realm-import
        mountPath: /import
volumes:
  - name: realm-template
    configMap:
      name: keycloak-realm-template
  - name: realm-import
    emptyDir: {}
```

The `keycloak-realm-template` ConfigMap is created from
`infrastructure/keycloak/realm-export.template.json`.

---

## Realm import behavior

`--import-realm` imports any `*-realm.json` files in `/opt/keycloak/data/import/`
**on first startup only**, when the realm doesn't already exist in the DB. If
the realm exists, the import is skipped — Keycloak does not overwrite live
configuration.

This means: editing `realm-export.template.json` and redeploying does **not**
update the production realm. To apply realm changes in production:

1. Either: drop and recreate the Keycloak DB (destructive — wipes users,
   sessions, audit logs).
2. Or: use `kcadm.sh` against the live Keycloak to apply the specific change
   (preferred for ongoing operations).
3. Or (heaviest): export the live realm, edit, re-import in maintenance window.

For M4 the realm is small and identical across redeploys, so the "drop and
recreate" approach is acceptable during the staging burn-in. For M5+ this
process must be replaced with `kcadm.sh` operations or the Keycloak Operator's
`KeycloakRealmImport` CR.

---

## Healthcheck

The dev compose healthcheck uses an inline Java probe (not `curl`) because
**the Keycloak 26 image does not ship `curl`**. The probe compiles a tiny
`HealthCheck.java` on first run, caches it in `/tmp`, and uses the bundled
JRE to call the realm's well-known endpoint.

In Kubernetes, prefer Keycloak's native management endpoints on port 9000:

```yaml
livenessProbe:
  httpGet:
    path: /health/live
    port: 9000
readinessProbe:
  httpGet:
    path: /health/ready
    port: 9000
```

This requires `KC_HEALTH_ENABLED=true` and exposes a dedicated management
port the probes can hit directly — no shell command needed. **Recommended
over copying the dev compose Java probe** into Helm values.

---

## Secrets, not env literals

Every variable in the [Required env vars](#required-env-vars) table marked
"from K8s Secret" must be sourced from a Kubernetes `Secret`, not embedded
as a literal in the Helm chart's `values.yaml`. The dev compose file uses
literals (`POSTGRES_PASSWORD: postgres` etc.) because audit items S1, S2, S3
are explicitly out of M4 scope per the audit's recommended fix order — they
are M5 grade points.

---

## What this document does **not** cover

- Helm chart structure or which Helm chart to use (Bitnami, Codecentric,
  custom, etc.) — DevOps's call.
- Ingress configuration (Nginx vs Traefik, cert-manager, etc.) — DevOps's call.
- Multi-replica Keycloak HA with JDBC_PING or KUBE_PING — out of scope for
  M4 demo (single replica is fine).
- Realm-import update strategies past initial deploy — see [§ Realm import behavior](#realm-import-behavior).
- The audit's other Keycloak hardening items (A4 brute-force protection,
  A5 ROPC disable, A1 audience validation — already shipped) — see
  `docs/audits/m3-m4-audit/dev-prod-gaps.md`.
