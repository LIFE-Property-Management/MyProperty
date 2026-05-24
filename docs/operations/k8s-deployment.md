# Kubernetes Deployment — MyProperty

## Overview

M4.4 ships the Helm chart (`helm/myproperty`) and CD workflow (`.github/workflows/cd.yml`) that deploy the full MyProperty stack to a DigitalOcean Kubernetes (DOKS) cluster.

**What this chart owns:**

| Tier | Components |
|---|---|
| App | Backend API, Frontend (Next.js), aiops-webhook |
| Data | Postgres, Redis, RabbitMQ, Keycloak |
| Migrations | EF Core bundle Job (pre-install/pre-upgrade hook) |
| Monitoring | Loki, Promtail, kube-prometheus-stack (Prometheus + Grafana + Alertmanager) |
| Ingress | Three Ingress resources for `app.`, `api.`, `auth.myproperty.works` |

**What this chart does NOT own** (cluster-scoped one-shots, applied once per cluster):
- ingress-nginx controller
- cert-manager + ClusterIssuer
- Kubernetes Secrets (credentials)
- GHCR pull secret

**Dependencies:**
- M4.7 Terraform provisions the DOKS cluster. This chart deploys onto whatever cluster exists.
- M4.9 locked in the three-subdomain, ingress-nginx + cert-manager architecture this chart implements.

**Deployment model:** Single cluster, single namespace (`myproperty`), single environment. No value layering. CD triggers on push to `main` or `develop`.

---

## Cluster prerequisites

**Provisioning the cluster:** the DOKS cluster itself is provisioned by Terraform — see
[`docs/operations/terraform.md`](./terraform.md). The bootstrap runbook below assumes
`terraform apply` has completed and you have the Terraform outputs available locally.

MyProperty requires the following to exist on the cluster before `helm install` runs.
These are cluster-scoped one-shots — they are **not** owned by the app chart.

### 1. Kubernetes 1.33+

DOKS provisions 1.34 as the latest; the chart is validated against 1.33.0 (one behind)
for conservative compatibility.

### 2. Default StorageClass `do-block-storage`

Provisioned automatically by DOKS. All PVCs in the chart reference this StorageClass.

### 3. ingress-nginx controller

```bash
# Note: kubernetes/ingress-nginx was archived 2026-03-24. Still functional for the
# demo lifetime; no drop-in migration tool available for replacement options.
# Tracked as M5 follow-up.
helm upgrade --install ingress-nginx ingress-nginx \
  --repo https://kubernetes.github.io/ingress-nginx \
  --namespace ingress-nginx --create-namespace \
  --set controller.service.type=LoadBalancer \
  --set controller.config.server-tokens="false" \
  --set controller.config.proxy-body-size="10m" \
  --set controller.config.use-forwarded-headers="true" \
  --set controller.config.ssl-protocols="TLSv1.2 TLSv1.3" \
  --set controller.metrics.enabled=true \
  --set controller.metrics.serviceMonitor.enabled=true
```

Wait for `EXTERNAL-IP` to populate (~1 min):

```bash
kubectl get svc -n ingress-nginx ingress-nginx-controller --watch
```

Note the `EXTERNAL-IP` — DNS records point at this IP.

### 4. cert-manager

```bash
helm upgrade --install cert-manager oci://quay.io/jetstack/charts/cert-manager \
  --namespace cert-manager --create-namespace \
  --version v1.20.2 \
  --set crds.enabled=true
```

Wait for all cert-manager pods to be Ready:

```bash
kubectl rollout status deployment/cert-manager -n cert-manager
kubectl rollout status deployment/cert-manager-webhook -n cert-manager
```

### 5. ClusterIssuer `letsencrypt-prod`

Save to `bootstrap/cluster-issuer.yaml` and apply:

```yaml
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: <LETSENCRYPT_EMAIL>
    privateKeySecretRef:
      name: letsencrypt-prod-account-key
    solvers:
      - http01:
          ingress:
            class: nginx
```

```bash
kubectl apply -f bootstrap/cluster-issuer.yaml
```

For debugging without burning Let's Encrypt rate limits, use the staging issuer first:

```yaml
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-staging
spec:
  acme:
    server: https://acme-staging-v02.api.letsencrypt.org/directory
    email: <LETSENCRYPT_EMAIL>
    privateKeySecretRef:
      name: letsencrypt-staging-account-key
    solvers:
      - http01:
          ingress:
            class: nginx
```

### 6. DNS A records

Create three A records pointing at the LoadBalancer `EXTERNAL-IP`:

| Hostname | Record type | Value |
|---|---|---|
| `app.myproperty.works` | A | `<LB_IP>` |
| `api.myproperty.works` | A | `<LB_IP>` |
| `auth.myproperty.works` | A | `<LB_IP>` |

DNS propagation can take a few minutes. Verify with `dig app.myproperty.works`.

### 7. GHCR pull secret

```bash
kubectl create namespace myproperty
kubectl create secret docker-registry ghcr-pull-secret \
  --docker-server=ghcr.io \
  --docker-username=<GITHUB_USERNAME> \
  --docker-password=<GITHUB_PAT_WITH_READ_PACKAGES> \
  --namespace myproperty
```

### 8. App Secrets

One Secret per concern, grouped by workload:

```bash
# Postgres credentials — values come from Terraform outputs captured in Step 0.
# This Secret now has 5 keys (added postgres-host, postgres-port vs the 3-key form).
kubectl create secret generic myproperty-postgres \
  --from-literal=postgres-user="$DB_USER" \
  --from-literal=postgres-password="$DB_PASSWORD" \
  --from-literal=postgres-db="$DB_NAME" \
  --from-literal=postgres-host="$DB_HOST" \
  --from-literal=postgres-port="$DB_PORT" \
  --namespace myproperty

# RabbitMQ credentials
kubectl create secret generic myproperty-rabbitmq \
  --from-literal=rabbitmq-user=guest \
  --from-literal=rabbitmq-password=<STRONG_PASSWORD> \
  --namespace myproperty

# Keycloak admin credentials
kubectl create secret generic myproperty-keycloak-admin \
  --from-literal=admin-user=admin \
  --from-literal=admin-password=<STRONG_PASSWORD> \
  --namespace myproperty

# Google OAuth (Keycloak IdP federation)
kubectl create secret generic myproperty-google-oauth \
  --from-literal=client-id=<GOOGLE_CLIENT_ID> \
  --from-literal=client-secret=<GOOGLE_CLIENT_SECRET> \
  --namespace myproperty

# Anthropic API key (backend OCR + aiops-webhook)
kubectl create secret generic myproperty-anthropic \
  --from-literal=api-key=<ANTHROPIC_API_KEY> \
  --namespace myproperty

# Discord webhook (aiops-webhook; Discord accepts Slack-compatible payloads)
kubectl create secret generic myproperty-discord \
  --from-literal=webhook-url=<DISCORD_WEBHOOK_URL> \
  --namespace myproperty

# Grafana admin credentials (consumed by kube-prometheus-stack)
kubectl create secret generic myproperty-grafana \
  --from-literal=admin-user=admin \
  --from-literal=admin-password=<STRONG_PASSWORD> \
  --namespace myproperty
```

---

## Bootstrap runbook

Ordered execution sequence for first-time cluster setup. Execute each step in order;
verify the expected output before continuing.

### Step 0 — Terraform apply + capture outputs

```bash
cd infrastructure/terraform
terraform output -json > /tmp/tf.json
export DOKS_CLUSTER_NAME=$(jq -r .cluster_name.value /tmp/tf.json)
export DB_HOST=$(jq -r .db_host.value /tmp/tf.json)
export DB_PORT=$(jq -r .db_port.value /tmp/tf.json)
export DB_NAME=$(jq -r .db_name.value /tmp/tf.json)
export DB_USER=$(jq -r .db_user.value /tmp/tf.json)
export DB_PASSWORD=$(terraform output -raw db_password)
```

Expected: every variable populated. Confirm `echo $DB_PASSWORD` returns a non-empty string.
Do not paste these into a shell history file you commit.

### Step 1 — Configure kubeconfig

```bash
doctl kubernetes cluster kubeconfig save $DOKS_CLUSTER_NAME
kubectl cluster-info
# Expected: Kubernetes control plane is running at https://<cluster-id>.k8s.ondigitalocean.com
```

### Step 2 — Install ingress-nginx

Run the `helm upgrade --install ingress-nginx ...` command from [§ Cluster prerequisites / 3](#3-ingress-nginx-controller).

Expected: `ingress-nginx-controller` pod in `Running` state.

```bash
kubectl get pods -n ingress-nginx
# NAME                                        READY   STATUS    RESTARTS   AGE
# ingress-nginx-controller-...               1/1     Running   0          ...
```

### Step 3 — Note the LoadBalancer IP

```bash
kubectl get svc ingress-nginx-controller -n ingress-nginx
# NAME                       TYPE           CLUSTER-IP      EXTERNAL-IP     PORT(S)
# ingress-nginx-controller   LoadBalancer   10.245.x.x      <LB_IP>         80:...,443:...
```

### Step 4 — Install cert-manager

Run the `helm upgrade --install cert-manager ...` command from [§ 4](#4-cert-manager).

Expected: cert-manager pods `Running`, webhook pod `Ready`.

### Step 5 — Apply ClusterIssuer

```bash
kubectl apply -f bootstrap/cluster-issuer.yaml
kubectl get clusterissuer letsencrypt-prod
# NAME               READY   AGE
# letsencrypt-prod   True    ...
```

### Step 6 — Create DNS records

At your DNS provider, create three A records pointing at `<LB_IP>` from Step 3.
Verify propagation:

```bash
dig +short app.myproperty.works    # should return <LB_IP>
dig +short api.myproperty.works
dig +short auth.myproperty.works
```

### Step 7 — Create namespace + GHCR pull secret + app Secrets

Run all commands from [§ 7](#7-ghcr-pull-secret) and [§ 8](#8-app-secrets).

Verify:

```bash
kubectl get secrets -n myproperty
# Expected: ghcr-pull-secret, myproperty-postgres, myproperty-rabbitmq,
#           myproperty-keycloak-admin, myproperty-google-oauth,
#           myproperty-anthropic, myproperty-discord, myproperty-grafana
```

### Step 8 — Helm install

```bash
cd <repo-root>
helm dependency update helm/myproperty
helm upgrade --install myproperty ./helm/myproperty \
  --namespace myproperty \
  --create-namespace \
  --atomic \
  --timeout 10m \
  --wait \
  --set postgres.enabled=false \
  --set backend.image.tag=<SHA> \
  --set frontend.image.tag=<SHA> \
  --set migration.image.tag=<SHA> \
  --set aiopsWebhook.image.tag=<SHA>
```

Replace `<SHA>` with the 7-character short SHA of the commit you want to deploy.
Get available SHAs from GHCR or `git log --oneline`.

Expected:

```
Release "myproperty" does not exist. Installing it now.
...
STATUS: deployed
```

From Step 8 onward, the CD workflow (`.github/workflows/cd.yml`) handles subsequent deploys automatically on push to `main` or `develop`.

> **Teardown:** do not run `terraform destroy` without first completing Steps 1–3 of the
> teardown recipe in [`docs/operations/terraform.md`](./terraform.md) (uninstall Helm releases,
> delete PVCs). Destroying the cluster while PVCs exist leaves orphaned block-storage volumes
> that keep billing.

---

## Install

See [§ Bootstrap runbook / Step 8](#step-8--helm-install) for the first-time install command.

The install sequence is:
1. M4.7 Terraform `apply` provisions the DOKS cluster.
2. Bootstrap runbook (Steps 1–7) installs cluster-wide prerequisites.
3. First `helm upgrade --install` from a local laptop (Step 8).
4. CD workflow takes over for all subsequent pushes.

---

## Upgrade

The CD workflow (`.github/workflows/cd.yml`) runs `helm upgrade --install` automatically
on every push to `main` or `develop`. Manual upgrade is for emergency overrides only:

```bash
helm upgrade myproperty ./helm/myproperty \
  --namespace myproperty \
  --atomic \
  --timeout 10m \
  --wait \
  --set backend.image.tag=<SHA> \
  --set frontend.image.tag=<SHA> \
  --set migration.image.tag=<SHA> \
  --set aiopsWebhook.image.tag=<SHA>
```

---

## Rollback

`--atomic` in the CD workflow automatically rolls back to the previous successful release
on any failure, so manual rollback is rarely needed.

To roll back manually:

```bash
# List available revisions
helm history myproperty -n myproperty

# Roll back to a specific revision
helm rollback myproperty <REVISION> -n myproperty
```

---

## Resources

Every Kubernetes resource kind shipped by this chart:

| Kind | Count | Purpose |
|---|---|---|
| Namespace | 1 | `myproperty` namespace with PSS baseline enforcement |
| Deployment | 4 | backend, frontend, keycloak, aiops-webhook |
| StatefulSet | 3 | postgres, rabbitmq, loki |
| DaemonSet | 1 | promtail (one pod per node) |
| Job | 1 | EF Core migration bundle (Helm pre-install/pre-upgrade hook) |
| Service | 7 | postgres, redis, rabbitmq, keycloak, backend, frontend, aiops-webhook, loki |
| ServiceAccount | 8 | one per workload |
| PersistentVolumeClaim | 1 | backend file storage (5Gi, RWO) |
| Ingress | 3 | frontend, api (with WebSocket timeouts), keycloak (with proxy buffers) |
| ConfigMap | 7 | postgres-init, keycloak-realm, loki-config, promtail-config, grafana-datasource-loki, grafana-dashboard-api-metrics, grafana-dashboard-api-logs |
| ClusterRole | 1 | promtail Pod read access |
| ClusterRoleBinding | 1 | promtail ServiceAccount binding |
| ServiceMonitor | 1 | backend `/metrics` scrape target (kube-prometheus-stack CRD) |
| PrometheusRule | 1 | M4.5 alert rules (kube-prometheus-stack CRD) |
| StatefulSet (sub-chart) | 2 | Prometheus, Alertmanager (via kube-prometheus-stack) |
| Deployment (sub-chart) | 3+ | Grafana, kube-state-metrics, operator (via kube-prometheus-stack) |

> PersistentVolume resources are provisioned dynamically by DOKS from the `do-block-storage` StorageClass — not listed above. StatefulSet `volumeClaimTemplates` provision PVCs for postgres (10Gi), rabbitmq (5Gi), loki (10Gi), prometheus (20Gi), alertmanager (1Gi), grafana (2Gi).

---

## Values reference

All image tags default to `latest` and **must** be overridden at deploy time via `--set`. The CD workflow sets them automatically to `${{ github.sha }}`.

| Key | Default | Description |
|---|---|---|
| `postgres.image.repository` | `postgres` | Postgres image |
| `postgres.image.tag` | `16-alpine` | Postgres image tag |
| `postgres.storage.size` | `10Gi` | Postgres PVC size |
| `postgres.storage.storageClassName` | `do-block-storage` | StorageClass for Postgres PVC |
| `postgres.resources.*` | 100m/256Mi req, 512Mi lim | Postgres CPU/memory |
| `redis.image.repository` | `redis` | Redis image |
| `redis.image.tag` | `7-alpine` | Redis image tag |
| `redis.resources.*` | 50m/64Mi req, 128Mi lim | Redis CPU/memory |
| `rabbitmq.image.repository` | `rabbitmq` | RabbitMQ image |
| `rabbitmq.image.tag` | `3-management` | RabbitMQ image tag |
| `rabbitmq.storage.size` | `5Gi` | RabbitMQ PVC size |
| `rabbitmq.storage.storageClassName` | `do-block-storage` | StorageClass for RabbitMQ PVC |
| `rabbitmq.resources.*` | 100m/256Mi req, 512Mi lim | RabbitMQ CPU/memory |
| `keycloak.image.repository` | `quay.io/keycloak/keycloak` | Keycloak image |
| `keycloak.image.tag` | `26.2` | Keycloak image tag |
| `keycloak.initImage.repository` | `alpine` | Init container image for realm envsubst |
| `keycloak.initImage.tag` | `3.20` | Init container image tag |
| `keycloak.resources.*` | 250m/512Mi req, 1000m/1Gi lim | Keycloak CPU/memory (JVM-heavy) |
| `backend.image.repository` | `ghcr.io/life-property-management/myproperty-api` | Backend API image |
| `backend.image.tag` | `latest` | **Set at deploy time** |
| `backend.replicas` | `1` | Backend replicas — capped at 1 by RWO PVC (M5 follow-up) |
| `backend.storage.size` | `5Gi` | Backend file storage PVC size |
| `backend.storage.storageClassName` | `do-block-storage` | StorageClass for backend PVC |
| `backend.resources.*` | 200m/512Mi req, 1000m/1Gi lim | Backend CPU/memory |
| `migration.image.repository` | `ghcr.io/life-property-management/myproperty-migrations` | Migration bundle image |
| `migration.image.tag` | `latest` | **Set at deploy time** |
| `frontend.image.repository` | `ghcr.io/life-property-management/myproperty-frontend` | Frontend image |
| `frontend.image.tag` | `latest` | **Set at deploy time** |
| `frontend.replicas` | `2` | Frontend replicas (stateless) |
| `frontend.resources.*` | 100m/256Mi req, 500m/512Mi lim | Frontend CPU/memory |
| `aiopsWebhook.image.repository` | `ghcr.io/life-property-management/myproperty-aiops-webhook` | AIOps webhook image |
| `aiopsWebhook.image.tag` | `latest` | **Set at deploy time** |
| `aiopsWebhook.resources.*` | 50m/128Mi req, 200m/256Mi lim | AIOps webhook CPU/memory |
| `loki.image.repository` | `grafana/loki` | Loki image |
| `loki.image.tag` | `3.2.0` | Loki image tag |
| `loki.storage.size` | `10Gi` | Loki PVC size |
| `loki.resources.*` | 100m/256Mi req, 512Mi lim | Loki CPU/memory |
| `promtail.image.repository` | `grafana/promtail` | Promtail image |
| `promtail.image.tag` | `3.2.0` | Promtail image tag |
| `promtail.resources.*` | 50m/64Mi req, 128Mi lim | Promtail CPU/memory |
| `kube-prometheus-stack.*` | (see values.yaml) | Full kube-prometheus-stack overrides for Prometheus retention, Alertmanager routing, Grafana persistence |

---

## Security primitives

Every pod in the chart applies the following baseline security posture:

- `securityContext.seccompProfile.type: RuntimeDefault` at the pod level
- `allowPrivilegeEscalation: false` on every container
- `capabilities.drop: [ALL]` on every container
- `automountServiceAccountToken: false` on every pod (**exception:** Promtail — needs the token for kubernetes_sd_configs Pod discovery)

### Per-workload UID and readOnlyRootFilesystem table

| Workload | runAsUser | readOnlyRootFilesystem | Notes |
|---|---|---|---|
| backend | 1654 | false | chiseled image expects UID 1654; Hangfire writes to tmp |
| frontend | 1000 | false | node user in alpine; Next.js writes to tmp |
| migration job | 0 (root) | false | Debian-base aspnet:10.0; M5 hardening pass |
| aiops-webhook | 1000 | true | FastAPI is stateless; root FS can be RO |
| postgres | 999 | false | postgres user in alpine image |
| redis | 999 | true | redis-server tolerates RO root |
| rabbitmq | 999 | false | writes to mnesia tmp |
| keycloak | 1000 | false | writes cache files; M4.8 tightening |
| loki | 10001 | true | filesystem storage is on a PVC, not root FS |
| promtail | 0 (root) | true | must read root-owned kubelet log files |

### Pod Security Standards

The `myproperty` namespace enforces `baseline` PSS:
- `enforce: baseline` — blocks privileged containers, host networking/PID, unsafe sysctls. Permissive enough that the migration job (root) and promtail (root) are not rejected at admission.
- `audit: restricted` + `warn: restricted` — surfaces what M4.8 will need to tighten (non-root, seccomp, capabilities) without blocking the deploy.

### Known exemptions

- **Migration job** runs as root (UID 0). Base image is `mcr.microsoft.com/dotnet/aspnet:10.0` (Debian-slim). M5 follow-up: rebuild on chiseled image with explicit UID, verify Hangfire serialization compatibility.
- **Promtail DaemonSet** runs as root. Required to read `/var/log/pods` which kubelet writes as root. M4.8 follow-up: investigate whether `runAsGroup` + adjusted log-file permissions can remove the requirement.

---

## CD workflow

`.github/workflows/cd.yml` fires on push to `main` or `develop`. Both branches deploy to the same `myproperty` release (latest push wins — single cluster, single environment per Decision #11).

### Trigger

```
on:
  push:
    branches: [main, develop]
```

### What it does

1. Checks out the repo.
2. Authenticates to DOKS via `doctl` using `DIGITALOCEAN_ACCESS_TOKEN`.
3. Installs Helm v3.20.0.
4. Runs `helm dependency update` to pull the kube-prometheus-stack chart.
5. Runs `helm upgrade --install myproperty` with all four image tags set to `${{ github.sha }}`.
6. Posts a Discord notification on success or failure.

### Safety properties

- **`--atomic`** — Helm rolls back to the previous successful release on any failure. The cluster never sits in a half-applied state.
- **`--timeout 10m`** — Postgres + Keycloak cold-start can take 5+ minutes. Default 5m would false-fail.
- **`--wait`** — blocks until all resources report Ready. The success Discord notification means "deployed and healthy," not "applied."
- **`concurrency: cancel-in-progress: true`** — if two commits land on the same branch in quick succession, the older run is cancelled to prevent concurrent `helm upgrade` conflicts.

### Required repo secrets

| Secret | Purpose |
|---|---|
| `DIGITALOCEAN_ACCESS_TOKEN` | doctl auth (Read+Write). Also used by M4.7 Terraform. |
| `DISCORD_WEBHOOK_URL` | Deployment notifications. |

### SHA-tag race condition

All four image tags are set to `${{ github.sha }}`. The CD workflow assumes the four image-build workflows (backend-ci, frontend-ci, aiops-webhook-ci, migration-bundle) have completed for this SHA before CD runs. If any image hasn't built yet, Helm fails on `ImagePullBackOff` and rolls back atomically — acceptable failure mode; re-run CD once the image is available.

### Manual override

```bash
gh workflow run cd.yml --ref main
```

Or trigger a fresh push. The CD workflow is the normal path; manual `helm upgrade` (see [§ Upgrade](#upgrade)) is for emergencies only.

---

## Operational notes

### MailHog not deployed

The backend is configured with `Smtp__Host=mailhog` and `Smtp__Port=1025`. MailHog is not shipped in M4.4 — no SMTP service exists in the cluster. The invite email flow degrades gracefully (backend pod still starts; only the invite-sending code path fails). Tracked as a post-M4 follow-up (real SMTP provider or hosted MailDev).

### Frontend bundle requires a fresh CI build after Phase 9

The frontend image must be rebuilt after `.github/workflows/frontend-ci.yml` was updated with real production URLs (Phase 9). Until a new image is pushed to GHCR with those URLs baked in, the deployed frontend will call placeholder domains. First deploy should use a SHA from a CI run triggered after the Phase 9 commit.

### Backend replicas capped at 1

`backend.replicas: 1` because the backend file storage PVC uses `ReadWriteOnce` — only one pod can mount a block volume at a time. Two replicas would cause the second pod to fail to schedule. M5 follow-up: migrate file storage to DO Spaces (S3-compatible), which removes the RWO constraint and allows horizontal scaling.

### ingress-nginx deprecation

The `kubernetes/ingress-nginx` GitHub repository was archived on 2026-03-24. The Helm chart still installs and functions for the demo lifetime. No drop-in replacement with a migration tool is available at the time of writing. Tracked as an M5 follow-up.

### kube-prometheus-stack CRD ownership

kube-prometheus-stack installs several CRDs (ServiceMonitor, PrometheusRule, Alertmanager, etc.) as part of its chart. These are cluster-scoped. If you ever uninstall kube-prometheus-stack, the CRDs remain — you must delete them manually if needed. Do not run `helm uninstall myproperty` carelessly in a shared cluster.

### First deploy is manual

The CD workflow fires on push to `main` or `develop`, but the first deploy must be run manually from a laptop after M4.7 provisions the cluster and the bootstrap runbook is executed. See [§ Bootstrap runbook / Step 8](#step-8--helm-install).

### CD workflow and branch protection

Branch protection on `main` is active. The CD workflow runs on pushes to `main` and `develop` via GitHub Actions — it authenticates with `GITHUB_TOKEN` / `DIGITALOCEAN_ACCESS_TOKEN` and does not require bypassing branch protection rules.

---

## Known follow-ups

### M4.8 (security hardening)
- NetworkPolicies — deny-by-default ingress/egress with explicit allow rules per workload
- sealed-secrets or external-secrets controller for Secret management (replaces manual `kubectl create secret`)
- Frontend distroless base image

### M5
- Migration image chiseled rebuild — switch from `mcr.microsoft.com/dotnet/aspnet:10.0` (Debian-slim) to chiseled variant; requires validating Hangfire serialization compatibility
- Backend RWO → DO Spaces — migrate `FileStorage__LocalRoot` to S3-compatible DO Spaces; removes ReadWriteOnce PVC constraint and unblocks `backend.replicas > 1`
- CloudNativePG operator for Postgres — M4.7 uses managed Postgres as the "real cloud resource" for Terraform; in-cluster Postgres stays plain for the demo
- ingress-nginx migration off the archived `kubernetes/ingress-nginx` chart — replacement controller TBD when a drop-in with migration tooling is available
- Multi-environment value layering — if a staging cluster is provisioned, add `values-staging.yaml` / `values-prod.yaml` overlays and `workflow_dispatch` parameterisation in frontend-ci.yml

### Post-M4
- MailHog or real SMTP in-cluster — closes the invite email flow degradation
- Renovate or Dependabot bumps for kube-prometheus-stack version
- Uptime Kuma (M4.6 deliverable, separate chart, same namespace)
- Wildcard cert via DNS-01 — removes the need to enumerate subdomains in the SAN list
- Frontend↔backend OIDC integration — the deployed wiring is correct (JWT auth, Keycloak authority, CORS) but the screen-level auth flow is downstream frontend work tracked as an M3 carry-over; M4.4 ships the deployment substrate only
