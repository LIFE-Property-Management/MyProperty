# Kubernetes Deployment — MyProperty

## Overview

## Cluster prerequisites

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
# Postgres credentials (consumed by backend, migration job, Keycloak)
kubectl create secret generic myproperty-postgres \
  --from-literal=postgres-user=postgres \
  --from-literal=postgres-password=<STRONG_PASSWORD> \
  --from-literal=postgres-db=myproperty \
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

### Step 1 — Provision the DOKS cluster

Run the M4.7 Terraform apply. Outputs the cluster name and kubeconfig.
Expected: cluster in state `running`, `kubectl cluster-info` returns the API server URL.

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

<!-- Populated in Phase 7 -->

---

## Values reference

<!-- Populated in Phase 11 -->

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

<!-- Populated in Phase 11 -->

---

## Known follow-ups

<!-- Populated in Phase 11 -->
