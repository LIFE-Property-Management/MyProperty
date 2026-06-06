# ADR-0004: DigitalOcean (DOKS) over GKE / EKS / AKS

- **Status:** **Superseded** by [ADR-0009](./0009-hetzner-project-02-over-doks.md) (2026-06-01). Originally Accepted at M4.4 (2026-Q1).
- **Deciders:** Full Team
- **Reflected in:** historical only — the current production target is documented in [`deployment-prod.md`](../deployment-prod.md) + [`cicd.md`](../cicd.md)

> ⚠️ **Superseded.** This ADR records why we *originally* chose DigitalOcean DOKS. In the M5 "de-DOKS" pass (PR #128, 2026-06-01) the production target moved to a namespace (`project-02`) on a **shared Hetzner cluster**: Terraform, DO Managed PostgreSQL, and DO Spaces are gone, and every data store is now self-hosted in-cluster on Longhorn. The reasoning below is kept as history; see [ADR-0009](./0009-hetzner-project-02-over-doks.md) for what replaced it and why.

## Context

M4.3 + M4.4 + M4.7 + M4.8 mandate **managed Kubernetes, CI/CD that targets a real cloud, Terraform-provisioned cloud resources, and Secret Manager / Key Vault integration**. We need: managed control plane (no kubeadm), block storage StorageClass, managed Postgres option, S3-compatible object storage, single-vendor billing for a school-budget demo, fra1-or-equivalent EU region for latency, and no per-pod ingress fees.

## Decision

Adopt **DigitalOcean Kubernetes (DOKS) in `fra1` (Frankfurt)** as the production target. Terraform provisions:

- `digitalocean_kubernetes_cluster.myproperty` — DOKS, default node pool, HA control plane **disabled** (cost).
- `digitalocean_database_cluster` — Managed PostgreSQL 16, single node (HA deferred).
- `digitalocean_spaces_bucket` — S3-compatible bucket for receipts, private ACL.

CD via GitHub Actions uses **`digitalocean/action-doctl@v2`** + **Helm** to upgrade the release. Image registry is **GHCR**, not DigitalOcean Container Registry — GHCR is free for public/open-source repos and integrates with the existing GitHub Actions workflow.

## Consequences

### Positive

- **Cost: free control plane** on the DOKS developer tier. **~$40/mo savings** by disabling HA control plane (acceptable for a demo).
- **Managed Postgres + Spaces in the same VPC + same bill** — one DigitalOcean account, no cross-cloud egress fees, one credential store.
- **`do-block-storage` StorageClass works out of the box** — every PVC in the chart (`postgres-statefulset` 10 Gi, `loki-statefulset` 10 Gi, `rabbitmq-statefulset` 5 Gi, `backend` 5 Gi, `prometheus` 20 Gi, `alertmanager` 1 Gi, `grafana` 2 Gi, `uptime-kuma` 2 Gi) requests this class. Total ~55 Gi.
- **Cilium CNI** is the default in DOKS — `NetworkPolicy` enforcement works without extra wiring when `networkPolicies.enabled: true` is flipped on.
- **Spaces' S3 compatibility** means the planned `SpacesFileStorage` impl reuses `AWSSDK.S3` libraries.

### Negative

- **No IRSA / Workload Identity** equivalent. AWS' IAM Roles for Service Accounts and GCP's Workload Identity remove the need to manage cloud-secret credentials inside the cluster. On DOKS, we ship credentials as Kubernetes Secrets (via External Secrets Operator or manual creation).
- **Smaller managed-service surface** than AWS/GCP — no managed Redis service (we self-host), no managed RabbitMQ (we self-host), no managed Kafka.
- **HA control plane is a paid add-on**, so a control-plane outage means downtime during the disabled tier.
- **Less mature autoscaler** in DOKS than HPA on GKE/EKS — we keep node pools sized statically.

### Mitigations

- Credential bootstrap is documented in [`docs/operations/k8s-deployment.md`](../../operations/k8s-deployment.md). The runbook is `kubectl create secret`; the alternative is External Secrets pulling from GCP Secret Manager or Azure Key Vault (`externalSecrets.enabled: true`).
- The chart's NetworkPolicies toggle is **off by default** to avoid breaking deployment on non-Cilium clusters; flipped on for DOKS-specific demos.
- HA control plane can be enabled with one Terraform variable change when budget permits.

## Alternatives considered

### Google Kubernetes Engine (GKE) — rejected

- Per-cluster management fee on Standard tier; Autopilot tier billing is per-resource-request, hard to predict for a demo.
- Cloud SQL (managed Postgres) costs more than DO Managed Postgres at the same instance size.
- More features than we need — Workload Identity, IAP, BinAuthz — that take time to set up correctly and don't ship value for the demo.

### Amazon EKS — rejected

- $0.10/hour per cluster control-plane fee. For a multi-week demo cluster running continuously: ~$72/mo just for the control plane.
- ALB Ingress Controller is a separate install with extra IAM setup.
- IRSA is excellent but adds a Trust Policy + OIDC provider setup step.

### Azure Kubernetes Service (AKS) — rejected

- Comparable price to EKS once you add network/storage egress.
- Azure Key Vault integration is the only edge over DOKS — but we get the same outcome via External Secrets Operator pointed at GCP/Azure (toggle in the chart values).

### Self-hosted K8s on DO Droplets — rejected

- We'd own the control plane upgrades, etcd backups, certificates, kubeadm joins, CNI install, etc.
- Defeats the M4.4 deliverable (which is "deployed via Helm to managed K8s").
