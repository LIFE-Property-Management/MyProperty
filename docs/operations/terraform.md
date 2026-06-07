# Terraform — RETIRED

> 🪦 **Retired 2026-06-01.** MyProperty no longer uses Terraform. It deploys to a shared
> **Hetzner** cluster (namespace `project-02`) via Helm + `infrastructure/gjirafa/deploy.sh`,
> and now via the automated CD workflow ([ci-cd.md](./ci-cd.md)). The DigitalOcean DOKS
> stack this document used to describe (`infrastructure/terraform/`) was **never applied to
> the current cluster** and has been **deleted** (the DO account is closed and its
> token/Spaces key revoked).

## Why there is no Terraform

We don't provision infrastructure as code on the current platform:

- **The cluster isn't ours to provision.** `project-02` is a namespace on a shared Gjirafa-
  managed Hetzner cluster; we have **namespace-admin only** (no cluster-scoped rights), so
  there is nothing for a cluster/Terraform provider to create.
- **Everything we own lives in the Helm chart.** Workloads, services, ingress, PVCs,
  NetworkPolicies, and the monitoring stack are all in `helm/myproperty` and applied by
  `deploy.sh` / `cd.yml`.
- **Cluster-scoped prerequisites are runbook steps, not IaC.** ingress-nginx, cert-manager,
  and DNS are one-shot/manual and documented in [k8s-deployment.md](./k8s-deployment.md).
- **Secrets are manual K8s Secrets** (`infrastructure/gjirafa/secrets.sh`); no External
  Secrets Operator (cluster-scoped).

## History

The original DOKS Terraform modules (DOKS cluster, managed Postgres 16, Spaces buckets for
remote state + receipts, DB firewall) and the full provisioning runbook are preserved in
git history — see this file before commit `feature/hetzner-cd` and the deleted
`infrastructure/terraform/` tree. The DOKS-vs-Hetzner pivot is tracked in
[deployment-roadmap.md](./deployment-roadmap.md).
