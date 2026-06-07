# ADR-0009: Shared Hetzner cluster (namespace `project-02`) over DigitalOcean DOKS

- **Status:** Accepted (M5, 2026-06-01). **Supersedes** [ADR-0004](./0004-doks-over-gke-eks.md).
- **Deciders:** Full Team
- **Reflected in:** [`deployment-prod.md`](../deployment-prod.md), [`cicd.md`](../cicd.md), [`technology-decisions.md`](../technology-decisions.md)

## Context

[ADR-0004](./0004-doks-over-gke-eks.md) put production on a DigitalOcean DOKS cluster that *we* owned and provisioned with Terraform. For a demo that runs for weeks, even DOKS' free control plane still bills for nodes, a managed Postgres, and a Spaces bucket — money spent to keep a continuously-running cluster alive.

Gjirafa offers a **shared, pre-existing Hetzner Kubernetes cluster** on which each project gets **one namespace** (`project-02`) with **namespace-admin RBAC** — at no cost to us. The constraint that comes with it is the whole story of this ADR: **we have no cluster-scoped permissions.** We cannot install CRDs, cluster-scoped controllers/operators, `ClusterIssuer`s, admission webhooks, or a GitOps controller. We can only create namespaced objects in `project-02`.

The question was whether to keep paying for a self-owned DOKS cluster or move the same Helm chart onto the borrowed namespace and live within namespace-admin limits.

## Decision

Adopt the **shared Hetzner cluster, namespace `project-02`** as the production target. Deploy the *same* `helm/myproperty` chart with a `values-gjirafa.yaml` overlay, via `infrastructure/gjirafa/deploy.sh` (manual) and `.github/workflows/cd.yml` (automated). Concretely:

- **Self-host every stateful service in-namespace** — Postgres, Redis, RabbitMQ, Keycloak, and Unleash all run as in-cluster workloads (no managed equivalents). PVCs use the cluster's **Longhorn** StorageClass.
- **No Terraform.** A borrowed namespace has nothing to provision as infrastructure-as-code; the chart + `values-gjirafa.yaml` + `secrets.sh` are the entire deployable surface.
- **TLS via a namespaced cert-manager `Issuer`**, not a `ClusterIssuer`. cert-manager itself is installed cluster-wide by the cluster operator; we only create the namespaced `Issuer` (`letsencrypt-prod`, ACME HTTP-01) + `Certificate` that the chart renders (`ingress.tls.createIssuers: true`).
- **CNI is Calico**, which enforces `NetworkPolicy`. The chart's NetworkPolicies are **on** in `values-gjirafa.yaml` (validated 2026-06-01) with a `nodeCIDRs` allowlist set to the Calico pod CIDR (`192.168.0.0/16`) because ingress-nginx runs as a hostNetwork DaemonSet and Calico rewrites cross-node source IPs to node tunnel addresses in the pod CIDR.
- **Secrets are manual Kubernetes Secrets**, bootstrapped by `infrastructure/gjirafa/secrets.sh` (generates stable passwords once, creates the Secrets) — no External Secrets Operator (it is cluster-scoped).
- **Observability is self-contained manifests, not the Prometheus Operator.** The `kube-prometheus-stack` Helm dependency was dropped (it ships cluster-scoped CRDs + an operator); Prometheus, Alertmanager, and Grafana are now plain in-namespace Deployments, with scrape config and alert rules wired directly (no `ServiceMonitor`/`PrometheusRule` CRDs). Promtail runs under a **namespaced `Role`** that tails only `project-02` pods.
- **CD is push-based GitHub Actions**, authenticating with the namespace kubeconfig stored as an Environment secret — pull-based GitOps (ArgoCD/Flux) is impossible without cluster-scoped controllers. See [ADR-0003 follow-ups in cicd.md](../cicd.md).

Production domain is `myproperty.works` (`app.` / `api.` / `auth.` / `grafana.` / `status.`).

## Consequences

### Positive

- **Zero infrastructure cost** — a borrowed namespace on someone else's cluster.
- **One chart, two environments.** `values-gjirafa.yaml` is a thin overlay over the same templates used for dev/Helm-local; there is no separate prod chart to drift.
- **NetworkPolicy actually enforced** — Calico gives default-deny + targeted-allow between tiers, with the data tier (postgres/redis/rabbitmq) locked to component selectors.
- **Managed TLS for free** — the shared cert-manager renews Let's Encrypt certs from our namespaced `Issuer`.

### Negative

- **Namespace-admin only** removes a whole class of tooling: no Prometheus Operator (self-contained manifests instead), no `ClusterIssuer` (namespaced `Issuer`), no External Secrets Operator (manual Secrets), no GitOps controllers (push-based CD), no cluster-wide Promtail DaemonSet (namespaced `Role`).
- **Shared-cluster blast radius** — a noisy neighbour or a cluster-operator change can affect us, and we cannot see or fix cluster-scoped problems ourselves.
- **Self-hosted stateful services** on replicated Longhorn storage carry the operational + performance cost we previously deferred to DO Managed Postgres.
- **Forward-only EF migrations + `--atomic`.** `--atomic` rolls back *workloads* on a failed deploy but not schema migrations, so a failed deploy can leave the DB partly migrated — verified manually.

### Mitigations

- The full deploy + secret-bootstrap + two-phase-wipe runbook lives in [`docs/operations/k8s-deployment.md`](../../operations/k8s-deployment.md); the de-DOKS cleanup and remaining deferred work are tracked in [`docs/operations/deployment-roadmap.md`](../../operations/deployment-roadmap.md).
- The CD pipeline gates on rollout status + HTTP health probes and posts failures to a dedicated Discord `#deployments` channel ([`cicd.md`](../cicd.md)).

## Alternatives considered

### Stay on DigitalOcean DOKS (the superseded ADR-0004) — rejected

Costs real money for the whole demo window, and we now have a free namespace that meets the same deliverable (deployed via Helm to managed K8s). The DOKS-specific wins (managed Postgres, Spaces, `ClusterIssuer`, Cilium) are nice-to-haves we can live without.

### GKE / EKS / AKS — rejected

Already rejected in [ADR-0004](./0004-doks-over-gke-eks.md) on cost/complexity; nothing changed except that the alternative is now *free* rather than *cheap*.

### A self-managed Hetzner cluster (our own, cluster-admin) — rejected

Would restore Operators/ClusterIssuers/ESO/GitOps, but we'd own the control plane, etcd backups, CNI install, and upgrades — the exact toil [ADR-0004](./0004-doks-over-gke-eks.md) rejected for "self-hosted K8s on Droplets." A borrowed namespace is strictly less work.
