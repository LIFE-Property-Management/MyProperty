# Required environment variables

**Purpose:** single source of truth for every environment variable / config key
the MyProperty stack reads at startup. Whenever a service fails to start with a
config error, this is the first document to consult.

**Maintenance rule:** every time a new config key is added to any service,
this table gets a new row in the same commit. PRs that add config keys without
updating this doc are incomplete.

**Conventions:**

- .NET reads nested config keys (`Cache:RedisConnection`) from `appsettings*.json`,
  user-secrets, and environment variables. In environment-variable form, the
  `:` separator becomes `__` (double underscore) — so `Cache:RedisConnection`
  becomes `Cache__RedisConnection`. Both refer to the same value.

- Next.js reads variables prefixed `NEXT_PUBLIC_` at build time and bakes them
  into the browser bundle. They are *not* runtime values. Changing them
  requires a rebuild.

- "Source of truth for prod" describes where the value lives in the deployed
  environment. K8s secrets for sensitive values; ConfigMaps for non-sensitive;
  hardcoded in Helm values only for environment-invariant strings.

---

## Backend API (.NET)

| Config key | Env var form | Required | Default | Source (dev) | Source (prod) | Notes |
|---|---|---|---|---|---|---|
| `Keycloak:Authority` | `Keycloak__Authority` | Yes | (none) | user-secrets | K8s ConfigMap | JWT issuer URL. e.g. `http://localhost:8080/realms/MyProperty` in dev. |
| `Keycloak:Audience` *(future)* | `Keycloak__Audience` | Yes (post-A1) | `myproperty-api` | appsettings.json | K8s ConfigMap | The audience string the API validates against. Wired in when A1 backend half lands. |
| `ConnectionStrings:Postgres` | `ConnectionStrings__Postgres` | Yes | (none) | user-secrets | K8s secret | Includes password — secret, not configmap. |
| `Cache:RedisConnection` | `Cache__RedisConnection` | Yes | (none) | user-secrets | K8s ConfigMap | No password in dev; prod may include `password=...`. |
| `SignalR:UseRedisBackplane` | `SignalR__UseRedisBackplane` | No | `true` | appsettings.json | K8s ConfigMap | Tests set this to `false` to skip Redis backplane. |
| `LokiUrl` | `LokiUrl` | No | (none) | appsettings.Development.json | K8s ConfigMap | When unset, logs go to console only. |
| `Invites:PortalBaseUrl` | `Invites__PortalBaseUrl` | Yes | (none) | appsettings.Development.json | K8s ConfigMap | Frontend URL used in invite emails. |
| `Invites:ExpiryDays` | `Invites__ExpiryDays` | No | `7` | appsettings.json | K8s ConfigMap | |
| `FileStorage:LocalRoot` | `FileStorage__LocalRoot` | Yes | (none) | appsettings.Development.json | K8s ConfigMap + PV mount | **Audit E2 / D4**: must be a mounted persistent volume path in prod, e.g. `/app/storage`. Receipts are lost on container restart otherwise. |
| `Anthropic:ApiKey` | `Anthropic__ApiKey` | No | (none) | user-secrets | K8s secret | When unset, OCR enters stub mode and logs once at startup. |
| `Anthropic:Model` | `Anthropic__Model` | No | `claude-sonnet-4-5-20250929` | appsettings.json | K8s ConfigMap | |
| `Anthropic:TimeoutSeconds` | `Anthropic__TimeoutSeconds` | No | `30` | appsettings.json | K8s ConfigMap | |
| `Smtp:Host` / `Smtp:Port` / `Smtp:UseStartTls` / `Smtp:Username` / `Smtp:Password` | `Smtp__*` | Yes | (none) | user-secrets / appsettings.Development.json | K8s secret (username/password); ConfigMap (host/port/tls) | **Audit E1**: `UseStartTls` MUST be `true` in any deployed environment. Cleartext SMTP otherwise. |
| `Cors:AllowedOrigins` *(future)* | `Cors__AllowedOrigins` | Yes (post-C1) | (none) | appsettings.Development.json | K8s ConfigMap | Comma-separated list of allowed origins. Added in C1. |

## Frontend (Next.js)

**Note:** all `NEXT_PUBLIC_*` variables are baked at build time. Changing them
requires a rebuild + redeploy of the frontend container.

| Variable | Required | Default | Source (dev) | Source (prod) | Notes |
|---|---|---|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | Yes (prod), No (dev) | (empty in dev) | `.env.local` (commented out) | Docker build arg | **Audit F1**: must be set at Docker build time for prod. Leave unset in dev so MSW intercepts relative URLs. |
| `NEXT_PUBLIC_KEYCLOAK_URL` | Yes | `http://localhost:8080` (dev) | `.env.local` | Docker build arg | **Audit F2**: must be browser-resolvable, not `localhost:8080`, in prod. |
| `NEXT_PUBLIC_DEV_AUTH_BYPASS` | No | `false` | `.env.local` (dev only) | (must not be set) | **Audit A2**: requires `.dockerignore` to exclude `.env.local` from prod build context. |

## Keycloak

| Variable | Required | Default | Source (dev) | Source (prod) | Notes |
|---|---|---|---|---|---|
| Startup command | Yes | — | `start-dev --import-realm` in compose | `start --import-realm` in Helm values | Audit E5. |
| `KC_PROXY_HEADERS` | Yes (prod), No (dev) | (none) | (unset) | `xforwarded` (Helm values) | **Without this, Keycloak returns 403 Forbidden on requests via Nginx.** |
| `KC_HOSTNAME` | Yes (prod) | (none) | (unset) | `https://auth.<prod-domain>` (Helm values) | Full URL with scheme. |
| `KC_HTTP_ENABLED` | Yes (prod) | (none) | (unset) | `true` (Helm values) | TLS terminates at Nginx; HTTP between Nginx and Keycloak. |
| `KC_HOSTNAME_STRICT` | No | `true` | (unset) | `true` (do not override) | The `false` shortcut from dev tutorials is a security regression. |
| `KEYCLOAK_ADMIN` | Yes | (none) | `admin` (compose, hardcoded) | K8s secret | **Audit S2**: must not be hardcoded in prod. |
| `KEYCLOAK_ADMIN_PASSWORD` | Yes | (none) | `admin123` (compose, hardcoded) | K8s secret | **Audit S2**: must not be hardcoded in prod. |
| `KC_DB_URL` / `KC_DB_USERNAME` / `KC_DB_PASSWORD` | Yes | (none) | compose | K8s secret | **Audit S1**: dev uses `postgres/postgres`; prod uses K8s secret. |
| Google IdP `clientSecret` | (deferred M4) | redacted in realm-export.json | user-secrets (dev) | (none in M4) | **Decision in `docs/decisions/keycloak-prod-config.md`**: Google SSO non-functional in prod for M4; addressed in M5. |

### Database (Keycloak's own state)

Keycloak persists its own state (users, sessions, audit logs) to a SQL database
configured via `KC_DB_*` variables.

**Dev:** the current `docker-compose.yml` does *not* configure a persistent
volume for Keycloak's internal H2 database. Realm state is rebuilt from
`realm-export.json` on every container start. This is intentional — it keeps
local dev clean — but it means any state created via the Keycloak admin UI
(test users, manual config tweaks) does not survive `docker compose restart`.

**Prod:** Keycloak must be configured with an external Postgres database via:

| Variable | Value |
|---|---|
| `KC_DB` | `postgres` |
| `KC_DB_URL` | jdbc URL to a Postgres instance (typically a separate database in the same cluster Postgres) |
| `KC_DB_USERNAME` / `KC_DB_PASSWORD` | K8s secret |

Without persisted state, every pod restart re-imports the realm and any users
created since the last restart (via SSO first-login, invite acceptance, etc.)
disappear. This is a hard blocker for any deployment that accepts real users.

`--import-realm` runs only on first start when the database is empty; on
subsequent starts with existing data, the flag is a no-op. This is the correct
behaviour — the export file is a seed, not an enforced state.

## Infrastructure (Postgres, Redis, RabbitMQ, Grafana)

| Variable | Required | Default | Source (dev) | Source (prod) | Notes |
|---|---|---|---|---|---|
| `POSTGRES_PASSWORD` | Yes | (none) | `postgres` (compose, hardcoded) | K8s secret | **Audit S1**: must not survive to prod. |
| `RABBITMQ_DEFAULT_USER` / `RABBITMQ_DEFAULT_PASS` | Yes | (none) | `guest/guest` (compose) | K8s secret | **Audit S3**. |
| `GF_AUTH_ANONYMOUS_ENABLED` | No | `false` | `true` (compose, with comment marking local-only) | **must not be set** | **Audit L2**: anonymous Admin Grafana access is critical-severity if reachable from any deployed environment. |
| `GF_AUTH_ANONYMOUS_ORG_ROLE` | No | (none) | `Admin` (compose) | **must not be set** | Same finding as above. |