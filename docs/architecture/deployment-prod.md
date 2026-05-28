# Deployment — Production (DOKS + Helm + Terraform)

Production runs on **DigitalOcean Kubernetes (DOKS)** in the `fra1` region. **Terraform** provisions the cluster and managed resources; **Helm** deploys the application chart on top of the cluster. Three off-the-shelf K8s addons (`ingress-nginx`, `cert-manager`, `external-secrets`) are installed cluster-wide and reused by the chart.

![Prod deployment topology (DOKS + Helm + Terraform)](./diagrams/deployment-prod.svg)

> **Sources:**
> - Cluster + managed services: [`infrastructure/terraform/`](../../infrastructure/terraform/) — see [`docs/operations/terraform.md`](../operations/terraform.md).
> - Application + observability: [`helm/myproperty/`](../../helm/myproperty/) (`templates/` + `values.yaml`).
> - CD glue: [`.github/workflows/cd.yml`](../../.github/workflows/cd.yml).

## What Terraform provisions

Defined in [`infrastructure/terraform/`](../../infrastructure/terraform/) (`cluster.tf` / `database.tf` / `spaces.tf` / `variables.tf` / `outputs.tf`). Bootstrap layer for the S3-compatible state backend lives in `infrastructure/terraform/bootstrap/`.

| Resource | Terraform | What |
|---|---|---|
| `digitalocean_kubernetes_cluster.myproperty` | `cluster.tf` | DOKS cluster, `fra1`, default node pool. HA control plane off (cost). |
| `digitalocean_database_cluster` (PostgreSQL 16) | `database.tf` | Optional managed DB. Used when `postgres.enabled: false` in the chart. Single-node for demo budget. |
| `digitalocean_spaces_bucket.receipts` + `digitalocean_spaces_key` | `spaces.tf` | S3-compatible bucket for receipts (private ACL), bucket-scoped key. Read by the M5 backend swap. |
| ClusterIssuer (Let's Encrypt prod) | `bootstrap/cluster-issuer.yaml` | One-time bootstrap applied after `cert-manager` is installed. HTTP-01 via the ingress-nginx controller. |

## What the Helm chart deploys

Chart [`helm/myproperty/`](../../helm/myproperty/) v0.1.0. Single dependency: `kube-prometheus-stack:65.2.0` (`prometheus-community`).

### Application tier

| K8s object | Image | Replicas / storage | Notes |
|---|---|---|---|
| `backend-deployment` | `ghcr.io/life-property-management/myproperty-api:{sha}` (chiseled .NET 10) | 1 replica, PVC 5 Gi (`do-block-storage`) | Single replica because of `ReadWriteOnce` PVC for receipt storage; M5 follow-up swaps to DO Spaces. |
| `frontend-deployment` | `ghcr.io/.../myproperty-frontend:{sha}` (distroless Node 20) | 2 replicas, no PVC | |
| `aiops-webhook-deployment` | `ghcr.io/.../myproperty-aiops-webhook:{sha}` (Python 3.14-slim) | 1 replica | |
| `migration-job` | `ghcr.io/.../myproperty-migrations:{sha}` | pre-upgrade Helm Hook | EF Core migration bundle; runs before `backend-deployment` rolls. |

### Data tier (in-cluster mode, default)

The chart renders an in-cluster StatefulSet for Postgres by default. Setting `postgres.enabled: false` in `values.yaml` skips those templates and the backend reads connection details from the `myproperty-postgres` Secret — Terraform-provisioned managed DB is the alternative path.

| K8s object | Image | Storage | Notes |
|---|---|---|---|
| `postgres-statefulset` + `postgres-service` + `postgres-init-configmap` | `postgres:16-alpine` | PVC 10 Gi | Hosts app + Hangfire + Keycloak schemas. |
| `redis-deployment` + `redis-service` | `redis:7-alpine` | ephemeral | Cache + SignalR backplane. |
| `rabbitmq-statefulset` + `rabbitmq-service` | `rabbitmq:3-management` | PVC 5 Gi | Topic exchange `myproperty.events`. |
| `keycloak-deployment` + `keycloak-service` + `keycloak-realm-configmap` | `quay.io/keycloak/keycloak:26.2` (+ `alpine:3.20` realm-init initContainer) | none | Realm imported from ConfigMap on first start. |

### Observability tier

| K8s object | Source | Storage | Notes |
|---|---|---|---|
| `prometheus` | Helm dep `kube-prometheus-stack` | PVC 20 Gi | Retention 15 d. Operator picks up `ServiceMonitor` + `PrometheusRule` CRDs anywhere in-cluster (`*SelectorNilUsesHelmValues: false`). |
| `alertmanager` | Helm dep | PVC 1 Gi | Configured in `values.yaml` → routes all alerts to `aiops-webhook` ClusterIP. |
| `grafana` | Helm dep | PVC 2 Gi | Admin secret-backed (`myproperty-grafana`). Dashboards + datasources provisioned via sidecar from chart-rendered ConfigMaps. |
| `loki-statefulset` + `loki-service` + `loki-configmap` | This chart | PVC 10 Gi | Single-binary mode. |
| `promtail-daemonset` + RBAC + ConfigMap + ServiceAccount | This chart | none | One pod per node; needs `pods` GET + `pods/log` GET cluster-wide. |
| `uptime-kuma-statefulset` + `uptime-kuma-seed-job` | This chart | PVC 2 Gi | Status page served via `uptime-kuma-ingress`. |
| `api-servicemonitor` + `api-prometheus-rule` | This chart (CRDs) | none | Scrape config + alert rules. Picked up by the operator. |

### Edge / routing

Four Ingress objects map subdomain → Service. All four share the same TLS host list so the cert covers `status.X` too.

| Ingress | Host | Backend |
|---|---|---|
| `frontend-ingress` | `app.{MYPROPERTY_DOMAIN}` | `frontend-service:3000` |
| `api-ingress` | `api.{MYPROPERTY_DOMAIN}` | `backend-service:8080` |
| `keycloak-ingress` | `auth.{MYPROPERTY_DOMAIN}` | `keycloak-service:8080` |
| `uptime-kuma-ingress` | `status.{MYPROPERTY_DOMAIN}` | `uptime-kuma-service:3001` |

TLS certs are issued by **cert-manager** via the Let's Encrypt ClusterIssuer bootstrapped from `infrastructure/terraform/bootstrap/cluster-issuer.yaml`. HTTP-01 challenge over the same `ingress-nginx` controller.

### Security (optional toggles)

| Feature | Toggle | What it does |
|---|---|---|
| **External Secrets Operator** | `externalSecrets.enabled: true` | Renders a `SecretStore` (GCP Secret Manager OR Azure Key Vault) + 13 `ExternalSecret` resources. ESO reconciles cloud secrets → in-cluster Secrets that the workload templates already reference. When disabled, operators bootstrap Secrets via the `kubectl create secret` runbook in [`docs/operations/k8s-deployment.md`](../operations/k8s-deployment.md). |
| **NetworkPolicies** | `networkPolicies.enabled: true` | Default-deny baseline + targeted allow rules between tiers. Requires CNI enforcement — DOKS ships Cilium, so works out of the box. |

The 13 ExternalSecret keys: `postgresUser`, `postgresPassword`, `postgresDb`, `rabbitmqUser`, `rabbitmqPassword`, `keycloakAdminUser`, `keycloakAdminPassword`, `googleOauthClientId`, `googleOauthClientSecret`, `anthropicApiKey`, `discordWebhookUrl`, `grafanaAdminUser`, `grafanaAdminPassword`.

## Deployment flow

A CD push triggers `.github/workflows/cd.yml`:

1. `azure/setup-helm` + `digitalocean/action-doctl` install tooling.
2. `doctl kubernetes cluster kubeconfig save myproperty` exports the kubeconfig.
3. `helm dependency update helm/myproperty` resolves `kube-prometheus-stack`.
4. `helm upgrade --install myproperty helm/myproperty --atomic --wait --timeout 10m` rolls the release.
5. `migration-job` runs pre-upgrade as a Helm Hook; if it fails, the chart rolls back.
6. Discord webhook posts success/failure.

## Production vs Dev — the deltas (recap)

Already enumerated in [`deployment-dev.md`](./deployment-dev.md) — repeating here only the items that show up in this diagram:

| Concern | Mechanism in prod |
|---|---|
| TLS | cert-manager + Let's Encrypt ClusterIssuer (HTTP-01 via ingress-nginx) |
| Object storage | DO Spaces bucket (Terraform-provisioned) — M5 swap from `LocalFileStorage` |
| Postgres | Toggleable: in-cluster StatefulSet (default) **or** DO Managed PostgreSQL 16 via Terraform |
| Secrets | Optional ESO from GCP Secret Manager or Azure Key Vault (alternative: manual `kubectl create secret`) |
| Pod isolation | Optional NetworkPolicies (default-deny + targeted-allow) |
| Image registry | GHCR (`ghcr.io/life-property-management/*`), tags `{short-sha}` + `{branch}` |
| Network model | One namespace `myproperty`; Services use ClusterIP; ingress-nginx is the single external entry |
| Observability | Prometheus Operator-managed (replaces compose Prometheus); kube-prometheus-stack provides Grafana + Alertmanager rules; Loki + Promtail still chart-rendered |

## Critical hardening details

- All workload images are **non-root** and **digest-pinned**. Backend runs as UID 1654 (chiseled `$APP_UID`); frontend as UID 65532 (distroless `nonroot`); AIOps webhook as `aiops` user.
- **Trivy** scans every image in CI; CRITICAL CVEs block; HIGH appear in GitHub Security tab.
- **CycloneDX SBOMs** uploaded per build, 90-day retention.
- **Helm release name = namespace name** (`myproperty`) so `kubectl -n myproperty` matches `helm upgrade myproperty`.
- `helm upgrade --atomic` ensures a failing release rolls back rather than leaving partial state.
