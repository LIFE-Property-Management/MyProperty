# Uptime monitoring — Uptime Kuma (M4.6)

This document describes MyProperty's uptime monitor layer: an
[Uptime Kuma](https://github.com/louislam/uptime-kuma) instance that
probes every service in the stack on a recurring schedule, exposes a
public status page, and fans out incident notifications across multiple
channels. Lands with M4.6 (2026-05-24).

## Overview

| Piece | Role | Compose | Kubernetes |
|---|---|---|---|
| `uptime-kuma` | Kuma server + UI + status page | service, host port 3002 → container 3001 | `StatefulSet` + `Service` + `Ingress` |
| `uptime-kuma-init` | One-shot seed — admin + monitors + status page + notifications | one-shot service, exits 0 | post-install Helm Job |
| `uptime_kuma_data` / PVC | SQLite DB + uploaded files | named volume | `volumeClaimTemplate` (RWO) |
| Slack notification | Incident alerts to `#alerts` | reuses `SLACK_WEBHOOK_URL` | secret `myproperty-discord/webhook-url` |
| Email notification | Incident alerts via SMTP | reuses Mailpit at `mailpit:1025` | per-env SMTP relay |

The seed runs on a fresh volume only — on re-run it detects the
existing admin and short-circuits to a no-op. Re-running is safe at
any time. Operator UI edits survive re-seeding (the seed reconciles
*by name*, not by id, and never deletes anything).

## Activation

### Local development (compose)

```bash
# Everything Uptime Kuma needs has compose-level defaults — a fresh
# clone runs the seed against http://localhost:3002 with credentials
# admin / changeme-please-1234. Override the admin password before
# exposing the host port to anything other than localhost:

cat >> .env <<'EOF'
KUMA_ADMIN_PASSWORD=<a-real-password-at-least-10-chars>
EOF

# Bring the stack up. The seed sidecar waits for Kuma's healthcheck to
# pass, then provisions monitors + notifications + the status page.
docker compose up -d
```

| URL | Purpose |
|---|---|
| http://localhost:3002 | Admin UI (login as the configured admin user) |
| http://localhost:3002/status/myproperty | Public status page |
| http://localhost:3002/dashboard | Live monitor heartbeats (admin only) |
| http://localhost:8025 | Mailpit — incoming notification emails for dev |

### Local development behind the nginx proxy (M4.9 + M4.6)

Add `status.${MYPROPERTY_DOMAIN}` to `/etc/hosts` next to the existing
three subdomains, then:

```bash
# Re-issue the self-signed cert so it covers the new SAN entry
./infrastructure/nginx/init-selfsigned.sh

cp .env.proxy.example .env  # or merge into existing .env
docker compose --profile proxy up -d --build
```

| URL | Purpose |
|---|---|
| https://status.myproperty.localhost/status/myproperty | Public status page |
| https://status.myproperty.localhost/dashboard | Admin UI |

### Production (Kubernetes / Helm)

```bash
# One-time: seed the admin password into the namespace secret
kubectl create secret generic myproperty-uptime-kuma \
  --namespace myproperty \
  --from-literal=admin-username=admin \
  --from-literal=admin-password='<at-least-10-chars>'

# helm upgrade --install handles everything else — the StatefulSet rolls,
# then the post-install Job runs the seeder.
helm upgrade --install myproperty ./helm/myproperty \
  --namespace myproperty --create-namespace \
  --set uptimeKuma.seedImage.tag=<SHA> \
  --set uptimeKuma.publicHost=status.myproperty.works \
  --set uptimeKuma.publicUrl=https://status.myproperty.works \
  --set uptimeKuma.smtp.host=smtp.sendgrid.net \
  --set uptimeKuma.smtp.port=587 \
  --set uptimeKuma.smtp.from='uptime@myproperty.works' \
  --set uptimeKuma.smtp.to='oncall@myproperty.works'
```

The public hostname is added to every Ingress's TLS `hosts:` list so
cert-manager issues a single SAN cert covering all four hostnames
(`app.`, `api.`, `auth.`, `status.`) — see
`infrastructure/nginx/PRODUCTION.md` for the mapping.

## What the seed provisions

The full source is in `infrastructure/uptime-kuma/monitors.json`. At a
glance:

**13 monitors.** Five HTTP probes against the application surface
(frontend, backend live/ready/diagnostics, Keycloak realm well-known);
two database probes (Postgres `SELECT 1`, Redis PING); six
infrastructure HTTP probes (RabbitMQ management, Loki, Prometheus,
Alertmanager, AIOps webhook, Grafana).

**Two notification channels.**
- *Slack (#alerts)* — only created when `SLACK_WEBHOOK_URL` is set.
  Same webhook the M4.11 AIOps service posts to, so all alerts land
  in one channel.
- *Email (oncall)* — only created when `KUMA_SMTP_HOST` is set. Compose
  default points at the in-stack Mailpit catcher so the demo is
  visible without an external SMTP account; K8s overrides to a real
  relay.

Both channels are marked **Default**, so monitors created later
through the UI automatically inherit them — operators don't have to
remember to attach channels.

**One public status page.** Slug `myproperty`, served at
`/status/myproperty`. Two monitor groups:

| Group | Monitors |
|---|---|
| Core services | Frontend, Backend live, Backend ready, Keycloak, Postgres, Redis |
| Infrastructure | Backend diagnostics, RabbitMQ, Loki, Prometheus, Alertmanager, AIOps webhook, Grafana |

The split matches the M4.5 alert-rule severity heuristic — Core
services are the things that, if down, mean the product is down for
users; Infrastructure is the things the on-call needs to know are
healthy but that don't directly gate user traffic.

## Idempotency model

The seed reconciles by **monitor / notification / status-page name**:

- Matching name → fields are updated in place (no churn on monitor IDs).
- Missing name → creates the resource.
- Name in Kuma but not in `monitors.json` → left alone. Operators can
  add monitors through the UI; the seed will not delete them.

This lets `docker compose up -d` and `helm upgrade` be called over and
over without worrying about duplicate monitors or notification spam.
It also means that *renaming* a monitor in `monitors.json` does NOT
rename the existing monitor — it creates a new one alongside the old.
For renames, edit the existing monitor in the UI (or delete + re-seed).

## Multi-channel notifications

The deliverable text calls for "multi-channel notifications." Both
channels above ship out of the box; either can be disabled by leaving
its env var empty.

| Channel | Compose env | K8s | Demo path |
|---|---|---|---|
| Slack | `SLACK_WEBHOOK_URL` | secret `myproperty-discord/webhook-url` | message in the configured webhook URL |
| Email | `KUMA_SMTP_*` | values `uptimeKuma.smtp.*` | Mailpit Web UI at http://localhost:8025 |

Operators can add more channels (Discord, Telegram, Pushover, PagerDuty,
generic webhooks, etc.) through the UI at any time. Kuma supports ~80
notification providers out of the box; the seed handles the two that
need first-run secret wiring.

## Network model

```
  ┌──────────────┐    probes (HTTP / TCP / SQL)      ┌──────────────┐
  │ uptime-kuma  │ ─────────────────────────────────▶│ backend      │
  │   :3001      │                                   │ frontend     │
  │              │                                   │ keycloak     │
  │              │                                   │ postgres ... │
  │              │                                   └──────────────┘
  │              │
  │              │ ─── slack webhook ──▶ Slack #alerts
  │              │ ─── smtp ───────────▶ mailpit (dev) / Resend (prod)
  └──────────────┘
         ▲
         │ socket.io (live UI + status page heartbeats)
         │
  ┌──────────────┐
  │ nginx :443   │ status.${MYPROPERTY_DOMAIN}
  └──────────────┘
         ▲
   browser (operator + public status page viewers)
```

Kuma uses **socket.io** for the live dashboard and for the status page
heartbeats. The nginx proxy vhost (M4.9) and the K8s Ingress both ship
the `Upgrade: websocket` headers + a 1h `proxy_read_timeout` so the
connection stays warm — without them the dashboard reconnects every
~60 s and looks like a Kuma bug.

The compose stack exposes Kuma on host port **3002** (not 3001) because
Grafana already binds 3001. Inside the docker network Kuma is on its
default port 3001 — the host mapping is the only deviation.

## Verification

Once the stack is up:

```bash
# Compose, no proxy
curl -s http://localhost:3002/api/entry-page | jq .
# {"type":"statusPageList"...}  (or {"type":"redirect","redirectUrl":"/dashboard"}
#  once a status page named myproperty is published)

curl -s http://localhost:3002/api/status-page/myproperty | jq .
# {"config":{"slug":"myproperty","title":"MyProperty — System Status",...},
#  "publicGroupList":[{"name":"Core services","monitorList":[...]}]}

# Status page (HTML) — should render with the configured monitors
curl -s http://localhost:3002/status/myproperty | grep -c "MyProperty — System Status"
# 1

# Seed sidecar logs — confirms the bootstrap completed
docker compose logs uptime-kuma-init | tail -20
# 2026-05-24T... [INFO] kuma-seed: Logged in as 'admin'
# 2026-05-24T... [INFO] kuma-seed: Notifications ready: 2 channel(s) wired
# 2026-05-24T... [INFO] kuma-seed: Monitors ready: 13 total
# 2026-05-24T... [INFO] kuma-seed: Status page '/status/myproperty' available at ...
# 2026-05-24T... [INFO] kuma-seed: Seed complete
```

Behind the proxy:

```bash
# HTTPS status page through nginx
curl -ki https://status.myproperty.localhost/status/myproperty | head -5

# socket.io polling handshake (also routed by nginx)
curl -ks "https://status.myproperty.localhost/socket.io/?EIO=4&transport=polling" \
  | head -c 80
# 0{"sid":"...","upgrades":["websocket"],"pingInterval":...
```

End-to-end smoke (intentionally trip a probe):

```bash
docker compose stop backend
# Wait ~90 s — the backend monitors transition to DOWN.
# Slack message lands (if SLACK_WEBHOOK_URL is set) and an email lands
# in Mailpit (http://localhost:8025).

docker compose start backend
# Monitors recover within one probe interval; resolution notifications
# fire on the same two channels.
```

## Operational notes

- **Admin password is the only gate on the admin UI in compose.** The
  M4.9 nginx proxy does not basic-auth the status hostname; the admin
  routes (`/dashboard`, `/manage-*`) sit at the same hostname as the
  public status page. Treat the admin password as production-grade
  even in dev once the stack is on a publicly-reachable host. M4.8
  hardening pass adds ingress-level basic-auth + IP allowlist on
  `/dashboard` and `/manage-*`.
- **`docker compose down -v` wipes the Kuma DB.** Includes monitor
  history + admin user + notification configuration. The seed
  re-provisions everything (idempotently) on the next start, so a wipe
  is a recoverable operation — just expect a fresh admin password
  prompt + lost historical uptime data. Same semantics as the
  `certbot_certs` volume documented in
  `docs/operations/nginx-ssl.md`.
- **Editing `monitors.json` requires a re-run of the seed.** Either
  restart the stack (`docker compose up -d uptime-kuma-init` for
  compose; `helm upgrade` for K8s) or run the seed image directly:
  `docker compose run --rm uptime-kuma-init`.
- **Status page slug is hardcoded as `myproperty`.** Changing the slug
  in `monitors.json` does NOT rename the existing status page — the
  seed creates a new one alongside it. Edit in the UI for renames.
- **SQLite on RWO storage means Kuma can't scale-out.** Replicas
  pinned to 1 in the StatefulSet. Kuma 2.x's optional PostgreSQL
  backend lifts this; revisit when 2.x reaches GA.
- **Kuma upgrades are non-destructive.** The SQLite schema migrations
  run on container start; first start after a tag bump may take ~30 s
  longer while the migration runs — `start_period` and probe initial
  delays are sized for this.

## Kubernetes mapping (M4.4 follow-up)

| Compose | Kubernetes |
|---|---|
| `uptime-kuma` service | `StatefulSet` + `Service` + `Ingress` |
| `uptime-kuma-init` one-shot | `Job` with `helm.sh/hook: post-install,post-upgrade` |
| `uptime_kuma_data` named volume | `volumeClaimTemplate` on the StatefulSet |
| `KUMA_ADMIN_PASSWORD` env | `Secret myproperty-uptime-kuma/admin-password` |
| `SLACK_WEBHOOK_URL` env | `Secret myproperty-discord/webhook-url` (shared with M4.11 AIOps) |
| `KUMA_SMTP_*` env | `values.uptimeKuma.smtp.*` (override at install time) |
| host port `3002` → container `3001` | `Ingress` for `status.myproperty.works` |

The Helm chart's post-install Job uses the same `seed.py` image the
compose `uptime-kuma-init` service builds. The image is built and
pushed to GHCR by a yet-to-be-added CI workflow
(`infrastructure/uptime-kuma/Dockerfile`); until that workflow lands
the chart references the placeholder `latest` tag — manual `docker
push` from the dev machine is the bridge.

## Known follow-ups (post-M4.6)

- **GHCR CI workflow for the seed image.** Mirrors the
  `aiops-webhook-ci.yml` pattern (ruff format/check, optional pytest,
  image build/push, Trivy SARIF). Tracks the M4.3 image-build
  convention so the chart's `--set uptimeKuma.seedImage.tag=<SHA>`
  has a real artefact to reference.
- **Ingress-level basic auth + IP allowlist on `/dashboard` and
  `/manage-*`.** Currently the admin UI is gated only by Kuma's
  session auth at the same hostname as the public status page; the
  M4.8 hardening pass adds annotation-driven basic auth to fence the
  admin surface off without losing the public status page.
- **Status page → AIOps webhook integration.** Today Kuma fires
  notifications independently of the M4.11 alert pipeline. A future
  PR can swap the email notification target for the AIOps webhook URL
  so Kuma incidents land in the same triage flow as Prometheus alerts
  (single Slack thread per service, LLM-summarised, etc.).
- **Historical uptime backup.** Kuma's SQLite DB is the system of
  record for monitor history — losing the PVC loses the timeline.
  M5: nightly `litestream` push to DO Spaces, restore on chart
  install. Out of M4 scope; the demo doesn't need durability beyond a
  single deployment lifetime.
- **External-probe location.** All current probes are *inside* the
  same network as the things they probe — they catch in-cluster
  failures but won't notice DNS / TLS / ingress-controller outages.
  M5: a second Kuma instance on a separate cloud / network probes
  the public URLs from outside (https://app.${DOMAIN},
  https://status.${DOMAIN}, etc.).
- **Kuma 2.x.** Adds clustered deployments + Postgres backend + a
  proper REST API. Currently beta; revisit when GA.
