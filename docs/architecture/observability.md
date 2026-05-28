# Observability stack

Four independent paths share a Grafana UI: **metrics** (Prometheus), **logs** (Loki + Promtail), **alerts** (Alertmanager → AIOps webhook → Slack), and **external probes** (Uptime Kuma → public status page + notifications).

![Observability stack](./diagrams/observability.svg)

> **Source:** [`diagrams/observability.puml`](./diagrams/observability.puml).

## Metrics path

| Step | Component | Detail |
|---|---|---|
| Emit | API process | `prometheus-net.AspNetCore` exposes `/metrics` (HTTP request duration, count, in-flight; .NET runtime counters; custom counters per domain) |
| Scrape | Prometheus | Every **15 s** (`scrape_interval`); in prod, `ServiceMonitor` CRD drives scrape config so the operator picks it up automatically |
| Store | Prometheus TSDB | **20 Gi** PVC, **15 d** retention (`do-block-storage` `ReadWriteOnce`) |
| Visualise | Grafana | Provisioned `api-metrics` dashboard (`grafana-dashboard-api-metrics-configmap`) — request latency, error rate, throughput, GC, working-set |

## Logs path

Two ingestion routes, one store.

| Source | How logs reach Loki | Why two routes |
|---|---|---|
| **API process** | Direct via `Serilog.Sinks.Grafana.Loki` (`LokiUrl` env var) | Sends rich structured JSON with `CorrelationId`, scopes, exception chains — no parsing required on the Loki side |
| **All other containers** (Postgres, Redis, RabbitMQ, Keycloak, Frontend, AIOps webhook, Loki, Prometheus, …) | Promtail reads container stdout, ships to Loki | Without Promtail every non-API container would be a `docker logs` debug session |

Promtail discovery differs by environment:

- **Dev:** Docker SD via `/var/run/docker.sock` (Docker socket SD). The compose service / project labels become Loki labels.
- **Prod:** Kubernetes DaemonSet with ServiceAccount + ClusterRole (read `pods` + `pods/log`). Tails `/var/log/pods/*` on every node.

Loki itself: **10 Gi** PVC, label-indexed (no full-text indexing → much lower resource footprint than Elasticsearch). See [ADR-0007](./adr/0007-loki-over-elk.md).

Grafana's `api-logs` dashboard (`grafana-dashboard-api-logs-configmap`) hits Loki via LogQL.

## Alerts path

Prometheus evaluates alert rules from `PrometheusRule` CRDs (in prod) or `alerts/*.yml` (in dev). Firing alerts → Alertmanager.

Alertmanager config (from `values.yaml`):

```yaml
route:
  receiver: 'aiops-webhook'
  group_by: ['alertname', 'severity']
  group_wait: 30s
  group_interval: 5m
  repeat_interval: 12h
inhibit_rules:
  - source_matchers: [severity = critical]
    target_matchers: [severity = warning]
    equal: ['alertname', 'service']
```

→ Routes everything to `aiops-webhook.myproperty.svc.cluster.local:5001/alerts` with a 12 h repeat interval. Critical alerts inhibit warning alerts on the same `alertname` + `service`.

### AIOps webhook

The Python FastAPI service receives the Alertmanager POST, sends each firing alert to **Claude Haiku** for triage, and posts the result to a Slack channel as a Block Kit message. Resolved alerts skip the LLM and post a short resolution.

**Graceful degradation:**

| Env var missing | Behaviour |
|---|---|
| `ANTHROPIC_API_KEY` | Triage disabled; raw labels/annotations posted to Slack with a `"Triage disabled"` header |
| `SLACK_WEBHOOK_URL` | Message bodies logged to stdout → Promtail → Loki → visible in Grafana Explore |
| both | Stdout-only with no Slack output (recoverable to logs) |

This deliberate fallback path is what made wiring "Webhook → LLM → Slack" deliverable in M4.11 without coupling to either provider — the demo works against a synthetic alert with a `curl`.

## External probes (Uptime Kuma)

Self-hosted lightweight uptime monitor with a public status page.

| Aspect | Detail |
|---|---|
| Probes | Recurring HTTPS GET against the public hosts (`app.X`, `api.X`, `auth.X`); 60 s default interval |
| Storage | SQLite on a **2 Gi** PVC (`uptime_kuma_data`) |
| UI | Internal admin UI (port 3001) + **public status page** at `status.X` (separate Ingress) |
| Notifications | Slack (same webhook as AIOps), email (configurable SMTP — defaults to dev placeholders) |
| Seeding | First-run Helm `Job` (`uptime-kuma-seed-job`) creates the admin user + monitors + notification channels + status page via Kuma's socket.io API |

## Grafana

| Surface | Provisioning |
|---|---|
| Datasources | `grafana-datasource-loki-configmap` (Loki) + kube-prometheus-stack defaults (Prometheus, Alertmanager) |
| Dashboards | `grafana-dashboard-api-metrics-configmap`, `grafana-dashboard-api-logs-configmap` (sidecar picks them up via label `grafana_dashboard`) |
| Auth | **Dev:** anonymous Admin (compose-only convenience). **Prod:** admin credentials from the `myproperty-grafana` Secret. |
| Persistence | 2 Gi PVC for state |

## Why this stack vs ELK

- **Loki + Promtail** uses label-based indexing rather than full-text. Lower CPU + memory footprint than Elasticsearch's JVM — important at MVP scale where the cluster is intentionally cost-bounded. The trade-off is that ad-hoc text search is slower; for *labelled* queries (`{container="myproperty-api"} | json | level="Error"`) the experience is comparable. See [ADR-0007](./adr/0007-loki-over-elk.md).
- **Grafana over Kibana** because we already need Grafana for Prometheus dashboards — one UI for both metrics and logs is a real win for triage.

## What this stack does *not* do

- **No distributed tracing** (Jaeger / Tempo). `CorrelationId` propagation is in place (Serilog middleware + Hangfire job arg), so traces can be reconstructed from logs in Grafana Explore — but there's no span-aware UI. Tempo is a sensible M6+ addition.
- **No long-term retention** of metrics beyond 15 days, or logs beyond Loki's default chunk lifetime. Retention shifts to object storage (Spaces) when data volume justifies it.
- **No SLO tooling** (Sloth, OpenSLO). Alert rules are absolute thresholds. SLOs are a deliberate post-M5 layer.
