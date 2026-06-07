# ADR-0007: Loki + Promtail over ELK Stack

- **Status:** Accepted (M3.13 / M4.5, 2026-Q1)
- **Deciders:** Full Team
- **Reflected in:** [`containers.md`](../containers.md), [`deployment-dev.md`](../deployment-dev.md), [`deployment-prod.md`](../deployment-prod.md), [`observability.md`](../observability.md)

## Context

M3.13 + DO-6 mandate **centralized log aggregation**. We need: structured JSON ingestion from the .NET backend (Serilog), stdout ingestion from every other container (Postgres, Keycloak, RabbitMQ, Frontend, AIOps webhook), label-based queries, retention sufficient for an incident-investigation cycle (~7 days), and integration with the metrics/dashboard UI we already need for M3.13 / M4.5 (Grafana).

The cluster budget is tight — Postgres + Keycloak + RabbitMQ + Redis + Prometheus + Loki + Grafana + ... all share modest node-pool resources. JVM-heavy services are a real concern.

## Decision

Adopt **Grafana Loki 3.2 + Promtail 3.2** for centralized log aggregation. The `.NET` backend ships logs to Loki via **`Serilog.Sinks.Grafana.Loki`** directly (preserves structured JSON + scopes). Every other container's stdout is tailed by **Promtail** — Docker socket SD in dev, Kubernetes pod-log tail (DaemonSet + RBAC) in prod.

Grafana is the consumer: pre-provisioned datasources (Loki + Prometheus + Alertmanager) and dashboards (`api-metrics`, `api-logs`).

## Consequences

### Positive

- **Resource footprint:** Loki uses ~256 MiB request, ~512 MiB limit. The equivalent Elasticsearch single-node would request ~1–2 GiB minimum (JVM heap floor). On a budget-constrained DOKS node pool, this matters.
- **Label-based indexing** (only labels are indexed; chunks store the rest) keeps storage growth manageable. PVC: 10 Gi prod (`do-block-storage`).
- **Grafana ⇄ Loki ⇄ Prometheus** is a coherent UX. Operators do not learn Kibana + Grafana; one tool for both metrics and logs (and alert state).
- **`Serilog.Sinks.Grafana.Loki` preserves scopes** (the `CorrelationId` + per-request enrichers), so labelled queries like `{container="myproperty-api"} | json | level="Error" | correlationId="..."` work out of the box.
- **Promtail** as a DaemonSet (prod) or Docker-socket-attached service (dev) means every container's logs land in Loki **without per-container shipper config**. Adding a container to the stack adds its logs to Loki automatically.

### Negative

- **Full-text search is slower than Elastic.** Loki was not built for it. A query like "find the string `OutOfMemoryException` across all containers in the last 24 h" scans chunks linearly per stream — manageable at our scale but noticeably slower than Elastic.
- **No mature anomaly-detection / ML features** (no Elastic ML / Watcher). For our use case, Prometheus alert rules cover the "spike in error rate" pattern; Loki rules can be added if needed.
- **Promtail's `docker_sd_configs`** in dev mounts the host's Docker socket — a security risk if Promtail were ever compromised. Acceptable for local dev; prod uses pod-log tail with a `ServiceAccount` instead.

### Mitigations

- The `api-logs` dashboard in Grafana is pre-provisioned with **labelled queries** that match the JSON structure the backend emits, so users hit the indexed path by default.
- **Production Promtail** is a `DaemonSet` with a `ServiceAccount` + RBAC (`pods` get + `pods/log` get) — no Docker socket exposure.

## Alternatives considered

### Elasticsearch + Logstash + Kibana (ELK) — rejected

- **Resource cost.** Single-node Elastic for a demo: ~1–2 GiB JVM heap floor + node-pool capacity for it.
- **Kibana as a separate UI.** We already need Grafana for metrics dashboards (M4.5). Two UIs is one too many for a single operator.
- **Logstash adds a second pipeline.** Promtail (Loki's shipper) is the singular path; Logstash would be a third moving part.

### OpenSearch + Filebeat — rejected

- Same resource concern as Elastic.
- Less native integration with Grafana — possible via plugins, not first-class.

### Fluentd / Fluent Bit + ClickHouse — rejected

- Steeper learning curve.
- ClickHouse for logs is a more bespoke setup; the operational burden exceeds the budget.

### Per-container stdout only (no aggregator) — rejected

- That's what `docker logs` gives us today. M3.13 / DO-6 explicitly require a centralised aggregator.
- Triaging an incident by `kubectl logs` across 9 containers is exactly what M4 was supposed to remove.
