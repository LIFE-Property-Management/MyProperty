# Security Hardening (M4.8)

This document describes MyProperty's security hardening posture as of M4.8
(2026-05-24). M4.8's deliverable text — "Trivy as CI quality gate, Key
Vault/Secret Manager, distroless images" — landed alongside the
NetworkPolicy matrix and PSS hardening items that M4.4 explicitly deferred
to this milestone.

## Overview

Four hardening axes ship in this milestone:

| Axis | Mechanism | Status |
|---|---|---|
| Image vulnerability scanning | Trivy CI quality gate (blocking on CRITICAL) | Live |
| Distroless image runtimes | API (M4.2), Frontend (M4.8), Migration (M4.8) | Live |
| Secret management | External Secrets Operator + GCP Secret Manager / Azure Key Vault | Opt-in |
| Network segmentation | Default-deny NetworkPolicy + targeted allows | Opt-in |

Each is described below alongside its triage / activation / rotation
workflow.

## Trivy quality gate

CI workflows run a **two-pass** Trivy scan after every image build:

| Pass | Severity | Exit code | Purpose |
|---|---|---|---|
| SARIF report | CRITICAL + HIGH | `0` (non-blocking) | Upload to GitHub Security tab |
| Quality gate | CRITICAL only | `1` (blocking) | Fail the build on un-suppressed CRITICALs |

Both passes honor `.trivyignore` at the repo root.

A CycloneDX SBOM is generated and uploaded as a build artifact (`sbom-<service>-<sha>.cdx.json`,
90-day retention) for downstream audit + offline CVE re-scanning.

### Triage workflow for new findings

1. Trivy fails a build on a new CRITICAL.
2. Inspect the advisory in the GitHub Security tab. Decide:
   - **Transitive dependency we don't reach:** allowlist with a dated
     expiration.
   - **Direct dependency with a fix:** bump the dependency, don't
     allowlist.
   - **Direct dependency without a fix yet:** allowlist with a short
     expiration; re-evaluate at expiry.
3. Append the CVE to `.trivyignore` in the form:
   ```
   CVE-YYYY-NNNNN exp:YYYY-MM-DD  # short rationale
   ```
   The `exp:` annotation is a human convention; Trivy itself ignores it.
4. Open a tracking issue if the allowlist is non-trivial. Review the
   allowlist monthly; entries past their `exp:` date go through the same
   triage as new findings.

Reference: <https://aquasecurity.github.io/trivy/latest/docs/configuration/filtering/>

### Why CRITICAL-only blocking (not HIGH)

Transitive dependencies in the .NET and Next.js ecosystems regularly carry
HIGH-severity advisories that don't apply to the consumer's usage profile.
Blocking on HIGH would generate frequent false-positive build failures with
no actionable fix. CRITICAL-only catches the genuinely urgent findings;
HIGH stays visible in the Security tab for scheduled triage.

## Distroless image runtimes

Distroless runtimes ship only the language runtime + shared libraries — no
shell, no package manager, no userspace tools. The hardening payoff is two-fold:
the attack surface inside the container shrinks dramatically, and the most
common post-exploitation primitives (downloading payloads, spawning shells,
chaining curl + jq + bash) become unavailable.

### Per-image status

| Image | Base | Non-root UID | Closed in |
|---|---|---|---|
| `myproperty-api` | `mcr.microsoft.com/dotnet/aspnet:10.0-noble-chiseled` | 1654 | M4.2 |
| `myproperty-migrations` | `mcr.microsoft.com/dotnet/aspnet:10.0-noble-chiseled` | 1654 | **M4.8** |
| `myproperty-frontend` | `gcr.io/distroless/nodejs20-debian12:nonroot` | 65532 (`nonroot`) | **M4.8** |
| `myproperty-aiops-webhook` | `python:3.14-slim` (custom non-root `aiops` user) | non-root | M4.11 |

The aiops-webhook stays on `python:3.14-slim` rather than
`gcr.io/distroless/python3-debian12` because the distroless Python image
was unmaintained as of 2024-Q4. Chainguard's `cgr.dev/chainguard/python` is
the actively-maintained alternative; promotion is an M5 follow-up if the
attack-surface reduction is judged worth a third-party registry dependency.

### Debugging on distroless / chiseled

`docker exec` is a closed door — no `ls`, no `cat`, no `sh`. Workarounds:

- **One-shot alpine sidecar against the same named volume:**
  ```bash
  docker compose run --rm --user 0:0 \
    --entrypoint sh backend-storage-init \
    -c "ls -lan /var/myproperty/storage"
  ```
- **`kubectl debug`** (K8s 1.23+): attach a debugger pod that shares the
  target's process namespace, with a busybox or netshoot image carrying the
  full toolset. Pod-level securityContext is inherited by the debug
  container.
- **Compose-level healthchecks:** use a probe written in the language
  already present in the image. Frontend uses `frontend/healthcheck.mjs`
  (Node-based HTTP probe). aiops-webhook uses `python -c 'urllib...'`.
  Backend (chiseled — no scripting language available at all) deliberately
  has no compose-level HEALTHCHECK; K8s probes hit the existing three-endpoint
  health pipeline directly from the kubelet.

### Image-size summary

| Image | Before M4.8 | After M4.8 | Notes |
|---|---|---|---|
| `myproperty-frontend` | ~274 MB (node:20-alpine) | ~190 MB (distroless) | ~30% reduction; standalone bundle dominates |
| `myproperty-migrations` | ~250 MB (aspnet:10.0) | ~225 MB (chiseled) | Modest delta — efbundle (~165 MB) dominates |

Sizes are approximate and depend on the digest pinned at build time.

## External Secrets Operator (Key Vault / Secret Manager)

ESO syncs values from a cloud secret manager into in-cluster `Secret`
resources that the existing workload templates reference unchanged. The
chart ships ESO support as **opt-in** behind `externalSecrets.enabled` — by
default, secrets follow the M4.4 manual `kubectl create secret` runbook.

### Prerequisites

ESO controller installed once per cluster (separate from the app release):

```bash
helm repo add external-secrets https://charts.external-secrets.io
helm install external-secrets external-secrets/external-secrets \
  -n external-secrets --create-namespace
```

This installs the ESO controller + CRDs (`SecretStore`, `ClusterSecretStore`,
`ExternalSecret`, etc.).

### Provider selection

`values.externalSecrets.provider` selects one of two backends:

#### Option A — GCP Secret Manager

1. Create a GCP project; enable the Secret Manager API.
2. Create the secrets in GCP Secret Manager. Default naming convention:
   `myproperty-<key-with-dashes>` (overridable per environment via
   `values.externalSecrets.secretRefs.*`).
3. Create a service account with `roles/secretmanager.secretAccessor` on
   each secret. Download a key JSON.
4. Bootstrap the credentials Secret in the cluster:
   ```bash
   kubectl -n myproperty create secret generic gcp-secret-manager-credentials \
     --from-file=credentials.json=/path/to/sa.json
   ```
5. Deploy with ESO enabled:
   ```bash
   helm upgrade --install myproperty ./helm/myproperty \
     --namespace myproperty --create-namespace \
     --set externalSecrets.enabled=true \
     --set externalSecrets.provider=gcp \
     --set externalSecrets.gcp.projectId=<your-gcp-project-id>
   ```

For production, replace the service-account JSON with GKE Workload Identity
— eliminates the bootstrap secret entirely. ESO supports it via the
`workloadIdentity` block on the SecretStore.

#### Option B — Azure Key Vault

1. Create a Key Vault. Add the secrets with the default `myproperty-*`
   names (or override via `values.externalSecrets.secretRefs.*`).
2. Create a service principal; grant it the `Key Vault Secrets User` role
   on the vault.
3. Bootstrap the credentials Secret:
   ```bash
   kubectl -n myproperty create secret generic azure-key-vault-credentials \
     --from-literal=client-id=<sp-client-id> \
     --from-literal=client-secret=<sp-client-secret>
   ```
4. Deploy with ESO enabled:
   ```bash
   helm upgrade --install myproperty ./helm/myproperty \
     --namespace myproperty --create-namespace \
     --set externalSecrets.enabled=true \
     --set externalSecrets.provider=azure \
     --set externalSecrets.azure.vaultUrl=https://my-kv.vault.azure.net \
     --set externalSecrets.azure.tenantId=<aad-tenant-id>
   ```

For production on AKS, use AKS Workload Identity (federated credential)
rather than a service principal — eliminates the bootstrap secret.

### Secret inventory

The chart renders one `ExternalSecret` per workload-referenced Secret:

| Kubernetes Secret | Key(s) | Default remote name |
|---|---|---|
| `myproperty-postgres` | `postgres-user`, `postgres-password`, `postgres-db` | `myproperty-postgres-user`, … |
| `myproperty-rabbitmq` | `rabbitmq-user`, `rabbitmq-password` | `myproperty-rabbitmq-user`, … |
| `myproperty-keycloak-admin` | `admin-user`, `admin-password` | `myproperty-keycloak-admin-user`, … |
| `myproperty-google-oauth` | `client-id`, `client-secret` | `myproperty-google-oauth-client-id`, … |
| `myproperty-anthropic` | `api-key` | `myproperty-anthropic-api-key` |
| `myproperty-discord` | `webhook-url` | `myproperty-discord-webhook-url` |
| `myproperty-grafana` | `admin-user`, `admin-password` | `myproperty-grafana-admin-user`, … |

`ghcr-pull-secret` (Docker config for image pulls) stays manually
bootstrapped — chicken-and-egg with image pulls + ESO controller image.

### Rotation

`refreshInterval` (default `1h`) controls how often ESO re-reads the
backend. Rotating a secret in the cloud backend triggers an in-cluster
`Secret` update within that interval; running workloads continue using the
old value until restarted. For immediate rollover, `kubectl rollout
restart` the affected deployment after rotation.

### Fallback path — sealed-secrets

For environments without cloud-secret-manager access (e.g. on-prem
homelabs), Bitnami sealed-secrets is a documented alternative:

```bash
# Install controller cluster-wide
helm repo add sealed-secrets https://bitnami-labs.github.io/sealed-secrets
helm install sealed-secrets sealed-secrets/sealed-secrets \
  -n kube-system

# Encrypt a Secret manifest using kubeseal
kubectl create secret generic myproperty-postgres \
  --from-literal=postgres-user=myproperty \
  --from-literal=postgres-password=$(openssl rand -base64 32) \
  --from-literal=postgres-db=myproperty \
  --dry-run=client -o yaml \
  | kubeseal --format yaml > sealed-postgres.yaml

# Commit the SealedSecret to Git; the controller decrypts in-cluster.
kubectl apply -f sealed-postgres.yaml
```

This deviates from the M4.8 deliverable text ("Azure Key Vault or GCP
Secret Manager") but is operationally equivalent — the encrypted material
lives in Git rather than a cloud vault, and the controller decrypts at
runtime. Document the deviation in the architecture doc if used.

## NetworkPolicy matrix

When `values.networkPolicies.enabled=true`, the chart ships a default-deny
baseline plus targeted allow rules.

### Default-deny + DNS

| Policy | Effect |
|---|---|
| `<release>-default-deny` | Denies all ingress + egress in the namespace |
| `<release>-allow-dns-egress` | Permits egress to `kube-system/k8s-app=kube-dns` on UDP/TCP 53 |
| `<release>-allow-prometheus-scrape` | Permits ingress from in-namespace `app.kubernetes.io/name=prometheus` pods |

### Per-workload allow rules

| Source → Destination | Port | Reason |
|---|---|---|
| ingress-nginx → frontend | 3000 | Public browser traffic |
| ingress-nginx → backend | 8080 | Public API traffic |
| ingress-nginx → keycloak | 8080 | Public auth flows |
| backend → postgres | 5432 | EF Core + Hangfire storage |
| backend → redis | 6379 | Dashboard cache + SignalR backplane |
| backend → rabbitmq | 5672 | Event publish |
| backend → keycloak | 8080 | JWKS discovery (MetadataAddress) |
| backend → loki | 3100 | Serilog → Loki sink |
| backend → external `:443` | 443 | Anthropic OCR, Google IdP, SMTP |
| keycloak → postgres | 5432 | Realm state |
| keycloak → external `:443` | 443 | Google IdP discovery + token exchange |
| migration → postgres | 5432 | EF migration apply |
| promtail → loki | 3100 | Log shipping |
| promtail → kube-apiserver | 443, 6443 | Pod discovery via kubernetes_sd_configs |
| alertmanager → aiops-webhook | 5001 | Alert webhook fan-out |
| aiops-webhook → external `:443` | 443 | Anthropic Claude + Slack/Discord |
| backend, promtail, grafana → loki | 3100 | Log queries (Grafana) + log shipping |

External egress (`0.0.0.0/0` with private CIDRs excepted) is permitted only
on port 443. Tighter destination control (cloud firewall, DOKS Egress
policy, etc.) belongs at the platform layer, not in the NetworkPolicy.

### Activation

```bash
helm upgrade myproperty ./helm/myproperty \
  --reuse-values --set networkPolicies.enabled=true
```

After enabling, verify enforcement from a pod that should not have access:

```bash
kubectl run -n myproperty netshoot --rm -it \
  --image=nicolaka/netshoot \
  --restart=Never -- \
  curl --max-time 5 http://postgres.myproperty.svc.cluster.local:5432
```

This should hang and time out. A successful connection means the CNI is
not enforcing NetworkPolicy (e.g. cluster running plain Flannel).

### CNI requirement

NetworkPolicy enforcement requires a CNI that implements it. **DOKS ships
Cilium by default**, which enforces. On clusters running plain Flannel,
NetworkPolicy resources install but provide no security — the chart
appears compliant while traffic is unrestricted. Verify with the
`kubectl run netshoot` smoke test above.

## Pod Security Standards

The `myproperty` namespace currently labels itself:

| Label | Value | Effect |
|---|---|---|
| `pod-security.kubernetes.io/enforce` | `baseline` | Blocks privileged containers, hostNetwork, hostPID |
| `pod-security.kubernetes.io/audit` | `restricted` | Surfaces what restricted would block |
| `pod-security.kubernetes.io/warn` | `restricted` | Same, as a deploy-time warning |

### Path to PSS=restricted

M4.4 deferred the bump from `baseline` to `restricted`. M4.8 closes one of
the two blocking workloads (migration job now runs non-root); promtail is
the remaining exemption.

**Promtail** needs root to read kubelet log files at
`/var/log/pods/*/...`. The standard workarounds:

- **Vector** as a Promtail replacement — newer, runs non-root with
  CAP_DAC_READ_SEARCH. Requires Loki write-config changes.
- **Fluent Bit** — same constraints as Promtail; no escape route.
- **Log-driven sidecar pattern** — every workload mounts its own log
  volume and runs a fluent-bit sidecar. Doubles the pod count, moves
  promtail's RBAC scope into per-workload tokens.

None of these are M4 critical-path; PSS=restricted is an M5 carry-over.

## Quick reference

| Document | What's there |
|---|---|
| [`ci-cd.md`](ci-cd.md) | Full CI pipeline structure, Dependabot, action versions, Trivy details |
| [`k8s-deployment.md`](k8s-deployment.md) | Helm chart bootstrap, cluster prerequisites, manual secret runbook |
| [`migrations.md`](migrations.md) | EF migration bundle contract |
| [`health-probes.md`](health-probes.md) | Three-endpoint K8s probe model |
| [`nginx-ssl.md`](nginx-ssl.md) | Compose-time Nginx + Let's Encrypt |
| **`security-hardening.md`** (this doc) | Trivy gate, ESO, NetworkPolicies, distroless, PSS |
