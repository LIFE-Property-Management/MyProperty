# Health Probes — Runtime Contract

This document describes the health probe endpoints exposed by MyProperty.Api and the recommended Kubernetes probe configuration.

## Endpoints

All endpoints are anonymous (no auth required) and live under `/api/v1/health`.

### `GET /api/v1/health/live`

**Purpose:** Liveness. Is the process responsive?

- **Status code:** Always 200 if the ASP.NET host is running. No downstream checks run.
- **Response body:** `UIResponseWriter` JSON with overall status `Healthy` and an empty `entries` object.
- **K8s use:** `livenessProbe` target. A failing live probe means the pod is unrecoverable and should be killed.

### `GET /api/v1/health/ready`

**Purpose:** Readiness. Is this pod ready to serve traffic?

- **Status code:**
  - `200 OK` if all checks tagged `ready` pass. Currently this is **Postgres only**.
  - `503 Service Unavailable` if any check tagged `ready` fails.
- **Response body:** `UIResponseWriter` JSON. Contains only the `postgres` entry (diagnostic checks are excluded from the predicate and do not appear here).
- **K8s use:** `readinessProbe` target. A failing ready probe removes the pod from the service rotation but does not kill it.

### `GET /api/v1/health/diagnostics`

**Purpose:** Human debugging. What is the full downstream picture right now?

- **Status code:**
  - `200 OK` if all registered checks pass.
  - `503 Service Unavailable` if any registered check fails.
- **Response body:** `UIResponseWriter` JSON. Includes per-check entries for `postgres`, `redis`, `rabbitmq`, `keycloak-jwks` with their individual statuses, durations, and (on failure) exception messages.
- **K8s use:** None. This endpoint is never used as a K8s probe target — it exists so an operator can curl one endpoint and see the full downstream picture without knowing which individual services are registered.

> **Note:** `/diagnostics` will return 503 in any environment where a downstream is missing or unreachable — including the integration test environment, which has Postgres and Keycloak but no Redis or RabbitMQ containers. This is correct behaviour: `/diagnostics` reports facts; K8s probes report fitness. A 503 from `/diagnostics` does not mean the API is broken for end-users.

## Why only Postgres blocks `/ready`

Redis, RabbitMQ, and Keycloak JWKS are intentionally **diagnostic-only**. They appear in `/diagnostics` for debugging but do not affect the `/ready` status code. Reasoning:

- **Redis:** Used only for the landlord dashboard cache and the SignalR backplane. The dashboard handler degrades gracefully (`RedisLandlordDashboardCache` swallows cache faults and falls through to the DB). Taking the API out of rotation because Redis hiccupped is a worse outage than serving the dashboard from the DB.
- **RabbitMQ:** Used only for event publishing in write paths. Read endpoints are unaffected by broker outages. Pulling the whole API out of rotation for a broker outage would make read paths fail for no reason.
- **Keycloak JWKS:** The JWT middleware caches JWKS aggressively (24h default, with cached keys retained on refresh failure). Brief Keycloak outages do not impact validation of already-issued tokens. Cold-start ordering is a deployment concern, not a runtime-readiness one.

If a future deployment needs stricter coupling (e.g., "API must not take traffic until Redis is up"), move the check's tag from `diagnostic` to `ready` in `Program.cs`.

## Response body shape

Example successful `/diagnostics` response (all checks healthy):

```json
{
  "status": "Healthy",
  "totalDuration": "00:00:00.1062101",
  "entries": {
    "postgres":      { "data": {}, "duration": "00:00:00.0005194", "status": "Healthy", "tags": ["ready"] },
    "redis":         { "data": {}, "duration": "00:00:00.0105964", "status": "Healthy", "tags": ["diagnostic"] },
    "rabbitmq":      { "data": {}, "duration": "00:00:00.0167333", "status": "Healthy", "tags": ["diagnostic"] },
    "keycloak-jwks": { "data": {}, "description": "JWKS endpoint reachable", "duration": "00:00:00.1045566", "status": "Healthy", "tags": ["diagnostic"] }
  }
}
```

Example `/ready` response (Postgres only):

```json
{
  "status": "Healthy",
  "totalDuration": "00:00:00.0085753",
  "entries": {
    "postgres": { "data": {}, "duration": "00:00:00.0057442", "status": "Healthy", "tags": ["ready"] }
  }
}
```

When a check fails, its entry includes `"description"` and `"exception"` fields with the failure cause.

## Recommended Kubernetes probe configuration

```yaml
livenessProbe:
  httpGet:
    path: /api/v1/health/live
    port: 8080
  initialDelaySeconds: 30
  periodSeconds: 30
  timeoutSeconds: 3
  failureThreshold: 3

readinessProbe:
  httpGet:
    path: /api/v1/health/ready
    port: 8080
  initialDelaySeconds: 10
  periodSeconds: 10
  timeoutSeconds: 5
  failureThreshold: 2
  successThreshold: 1
```

### Probe parameter reasoning

- **Liveness `initialDelaySeconds: 30`**: ASP.NET cold start with EF Core, JWT middleware, and RabbitMQ consumer initialization takes ~10–15s on cold cache. 30s leaves margin so a slow startup doesn't get the pod killed mid-boot.
- **Liveness `periodSeconds: 30`**: Liveness is cheap, but frequent probes during a real outage just churn pods. 30s is a reasonable cadence for "is the process alive."
- **Liveness `failureThreshold: 3`**: Tolerate two consecutive blips (network, GC pause) before kill.
- **Readiness `initialDelaySeconds: 10`**: Faster than liveness — readiness can flap during startup as DB connections warm. The probe failing during the first 10s is normal.
- **Readiness `periodSeconds: 10`**: Tighter than liveness so a downed Postgres pulls the pod out of rotation quickly.
- **Readiness `failureThreshold: 2`**: Faster yank than liveness — false positives are cheap (pod gets re-added on next success) but false negatives are expensive (broken pod serves traffic).
- **`successThreshold: 1`**: Default; one successful probe re-adds the pod.

## Probe authentication

Endpoints are explicitly `AllowAnonymous` because the default `FallbackPolicy` in `Program.cs` requires an authenticated user. K8s probes hit these endpoints without a JWT.

## Cold-start ordering for Keycloak

Because Keycloak JWKS is diagnostic-only, the API will pass `/ready` even when Keycloak is unreachable. If Keycloak is genuinely down at API pod startup, the API will accept traffic but authenticated requests will 401 (the JWT middleware has no cached signing keys and cannot reach Keycloak to fetch them).

If this matters in your deployment, solve it at the orchestration layer: order Keycloak before the API in the Helm chart or use a startup `initContainer` that probes `KEYCLOAK_INTERNAL_URL/health/ready` before allowing the API container to start. The probe contract here is deliberately lenient because in most failure modes Keycloak being briefly unreachable does not impair the API.

## Verification

To verify probes locally against the dev Docker Compose stack:

```bash
# Liveness — always 200, empty entries
curl -i http://localhost:5042/api/v1/health/live

# Readiness — 200, postgres entry only
curl -i http://localhost:5042/api/v1/health/ready

# Diagnostics — all checks with their individual status
curl -i http://localhost:5042/api/v1/health/diagnostics    # 200 when all healthy

# Simulate Postgres outage — /ready should 503, /diagnostics shows postgres Unhealthy
docker compose stop postgres
curl -i http://localhost:5042/api/v1/health/ready          # 503
curl -i http://localhost:5042/api/v1/health/diagnostics    # 503, postgres Unhealthy
docker compose start postgres

# Redis outage: /ready stays 200, /diagnostics goes 503
docker compose stop redis
curl -i http://localhost:5042/api/v1/health/ready          # 200 — Redis not in predicate
curl -i http://localhost:5042/api/v1/health/diagnostics    # 503 — Redis Unhealthy, full picture
docker compose start redis
```
