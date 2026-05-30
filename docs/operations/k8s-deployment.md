# Kubernetes Deployment — MyProperty

## Overview

MyProperty deploys to a **shared Hetzner Kubernetes cluster** into a single namespace,
**`project-02`**, via the Helm chart `helm/myproperty` and the staged deploy script
`infrastructure/gjirafa/deploy.sh`.

> **History:** an earlier approach targeted DigitalOcean DOKS + managed Postgres +
> Name.com, provisioned by Terraform. That path was **abandoned** (see
> [deployment-roadmap.md](./deployment-roadmap.md) for the cleanup of the remaining DOKS
> artifacts). `docs/operations/terraform.md` is superseded.

**What the chart owns:**

| Tier | Components |
|---|---|
| App | Backend API, Frontend (Next.js), aiops-webhook |
| Data | Postgres, Redis, RabbitMQ, Keycloak (all in-cluster) |
| Migrations | EF Core bundle Job (pre-install/pre-upgrade hook) |
| Ingress | Three Ingress resources for `app.`, `api.`, `auth.myproperty.works` + namespaced cert-manager `Issuer`s |
| Monitoring | Loki, Promtail, kube-prometheus-stack — **disabled** in the `project-02` overlay (`monitoring.enabled: false`); deferred to the monitoring batch |

**What the chart does NOT own** — on the shared cluster these are **provided by the
cluster operator**, not installable by us (the service account is namespace-scoped):

- ingress-nginx controller (`IngressClass: nginx`)
- cert-manager (the CRDs/controller; we only create namespaced `Issuer`s)
- the default StorageClass (`longhorn`)
- Kubernetes Secrets / GHCR pull secret (we create these in our namespace via `secrets.sh`)

**Deployment model:** single namespace (`project-02`), single environment, manual deploy
loop. There is **no automated CD** today — the dead DOKS `cd.yml` was removed. See
[ci-cd.md](./ci-cd.md) for the current pipeline and [deployment-roadmap.md](./deployment-roadmap.md)
for the planned Hetzner CD workflow.

---

## Access model (read this first)

The service account in `project-02` has **full namespaced admin but zero cluster-scoped
reads**. Practical consequences:

- You **cannot** `kubectl get nodes` / `get svc -A` / list anything cluster-wide.
- To learn the ingress entrypoint, read the **namespaced** `Ingress.status.loadBalancer`,
  not the ingress-nginx Service.
- All `kubectl`/`helm` commands target the namespace with the repo-root kubeconfig:
  `--kubeconfig project-02.kubeconfig -n project-02`.

### Cluster facts (verify, don't trust blindly)

- **Ingress entrypoint = the 4 Hetzner worker node IPs:** `159.69.16.208`,
  `159.69.2.83`, `159.69.5.128`, `159.69.8.132`. ingress-nginx publishes these.
- **`159.69.213.73` is the Kubernetes API server (`:6443`), NOT the ingress.** Do not
  point DNS at it.
- Default `StorageClass`: `longhorn`. `IngressClass`: `nginx`.
- **DNS (Name.com):** `app` / `api` / `auth`.myproperty.works each have **4 A records →
  the 4 node IPs** (12 total), TTL 300.

> Hardcoded node IPs go stale if the node set changes. Open question for the provider:
> is there a stable floating IP / LB / wildcard hostname? Tracked in
> [deployment-roadmap.md](./deployment-roadmap.md).

---

## Prerequisites (one-time, per namespace)

1. **`project-02.kubeconfig`** at the repo root (provided by the cluster operator).
   `deploy.sh`/`secrets.sh` default to it; override with `KUBECONFIG=...`.
2. **Secrets** created in `project-02` — run `infrastructure/gjirafa/secrets.sh`
   (see next section).
3. The cluster-operator-provided ingress-nginx + cert-manager + `longhorn` StorageClass
   already exist (they do on this cluster).

### Secrets — `infrastructure/gjirafa/secrets.sh`

Idempotent. Copy the template and fill in operator-supplied values, then run:

```bash
cp infrastructure/gjirafa/secrets.env.example infrastructure/gjirafa/.secrets.env
# edit .secrets.env: GHCR_USERNAME, GHCR_PAT, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, ANTHROPIC_API_KEY
infrastructure/gjirafa/secrets.sh
```

`.secrets.env` is gitignored. The script **generates and persists** the random passwords
(Postgres, RabbitMQ, Keycloak admin, Keycloak DB, Redis, `myproperty-api` client secret)
on first run and reuses them on re-runs — never regenerate them by hand. It then applies
these Secrets in `project-02`:

| Secret | Holds |
|---|---|
| `ghcr-pull-secret` | GHCR docker-registry creds (image pulls) |
| `myproperty-postgres` | postgres user/password/db/host/port + `keycloak-db-password` |
| `myproperty-rabbitmq` | rabbitmq user/password |
| `myproperty-keycloak-admin` | keycloak admin user/password |
| `myproperty-google-oauth` | Google IdP client id/secret |
| `myproperty-anthropic` | Anthropic API key (backend OCR + aiops-webhook) |
| `myproperty-redis` | redis password |
| `myproperty-api-client` | `myproperty-api` Keycloak client secret (service account) |

---

## Deploy — `infrastructure/gjirafa/deploy.sh`

The single staged deploy command, reused every change. It wraps:

```bash
helm upgrade --install myproperty helm/myproperty \
  --kubeconfig project-02.kubeconfig \
  --namespace project-02 \
  --values helm/myproperty/values-gjirafa.yaml \
  "$@"          # extra args passed through to helm
```

Then prints `kubectl -n project-02 get pods,pvc`.

- **No `--wait` / `--atomic`** — intentional: partial state persists for debugging.
  Verify with `kubectl` afterwards (don't trust "helm succeeded" alone).
- **`values-gjirafa.yaml`** is the overlay that makes the chart fit this cluster:
  `storageClassName: longhorn` everywhere, namespaced cert-manager `Issuer`s
  (`createIssuers: true`, staging + prod), `monitoring.enabled: false`,
  `uptimeKuma.enabled: false`, and the **pinned image tags**.

### Image tags

Images live in `ghcr.io/life-property-management/*` and are pinned by **7-char short SHA**
in `values-gjirafa.yaml` (`backend.image.tag`, `migration.image.tag`,
`frontend.image.tag`). The image-CI workflows build and push these on every push to
`main`/`develop` (see [ci-cd.md](./ci-cd.md)). To roll a new build, set the tag in
`values-gjirafa.yaml`, commit, and run `deploy.sh`.

### Standard release loop (e.g. a frontend change)

```bash
SHA=$(git rev-parse --short HEAD)
# build + push the image for $SHA (see ci-cd.md / the frontend Dockerfile build args),
# then pin it:
#   frontend.image.tag: "$SHA"   in helm/myproperty/values-gjirafa.yaml
infrastructure/gjirafa/deploy.sh
kubectl --kubeconfig project-02.kubeconfig -n project-02 rollout status deploy/myproperty-frontend
```

Frontend is stateless `RollingUpdate` — wait for the rollout and confirm both pods are on
the new tag and the old ReplicaSet has drained (round-robin can still hit old pods until
then).

> **Backend** uses `strategy: Recreate` (its file-storage PVC is `longhorn` RWO, so
> `backend.replicas: 1`); a rolling update would deadlock on the single-attach volume.

---

## TLS

cert-manager is cluster-provided; we create **namespaced `Issuer`s** (not ClusterIssuers —
the SA can't). `values-gjirafa.yaml` sets `tls.issuerKind: Issuer`, `createIssuers: true`,
`acmeEmail: erdi.syla@gjirafa.com`, and defines both `letsencrypt-staging` and
`letsencrypt-prod`.

Issuance flow used at go-live: validate the HTTP-01 challenge against **staging** first,
then flip `tls.issuerName`/the active issuer to **prod** and delete the `myproperty-tls`
secret to force re-issue. Current state: trusted Let's Encrypt **prod** cert,
`myproperty-tls` `Ready=True`, SAN = exactly `app`/`api`/`auth`.myproperty.works,
auto-renewing.

---

## Verify a deploy (behaviour, not just "Running")

```bash
K="kubectl --kubeconfig project-02.kubeconfig -n project-02"
$K get pods                                   # all workloads Running, low restarts
$K get ingress                                # app/api/auth present
$K rollout status deploy/myproperty-frontend  # (and backend/keycloak as relevant)
```

HTTP smoke (from anywhere):

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://app.myproperty.works/        # 200
curl -s -o /dev/null -w "%{http_code}\n" https://app.myproperty.works/login   # 200
curl -s -o /dev/null -w "%{http_code}\n" https://api.myproperty.works/api/v1/me  # 401 (needs token; NOT 404/CORS)
```

End-to-end (browser): sign up / sign in at `https://app.myproperty.works`, authenticate at
`auth.`, land on the role portal; backend calls to `api.` succeed with a valid token. See
[auth-flow.md](./auth-flow.md) for the full login/logout flow the frontend implements.

---

## Rollback

```bash
helm --kubeconfig project-02.kubeconfig -n project-02 history myproperty
helm --kubeconfig project-02.kubeconfig -n project-02 rollback myproperty <REVISION>
```

For a code rollback, re-pin the previous image tag in `values-gjirafa.yaml` and re-run
`deploy.sh`.

---

## Resources shipped by the chart

| Kind | Notes |
|---|---|
| Deployment | backend, frontend, keycloak, aiops-webhook (aiops/monitoring off in this overlay) |
| StatefulSet | postgres, rabbitmq (+ loki when monitoring on) |
| Job | EF Core migration bundle (pre-install/pre-upgrade hook) |
| Service | postgres, redis, rabbitmq, keycloak, backend, frontend |
| Ingress | frontend (`app`), api (WebSocket timeouts), keycloak (`auth`, proxy buffers) |
| Issuer | `letsencrypt-staging`, `letsencrypt-prod` (namespaced) |
| ConfigMap | postgres-init, keycloak-realm, (+ monitoring configs when on) |
| PersistentVolumeClaim | backend file storage (5Gi RWO, `longhorn`); StatefulSet PVCs for postgres (10Gi) + rabbitmq (5Gi) |
| Secret | created out-of-band by `secrets.sh` (see above) |

Monitoring resources (Loki, Promtail, kube-prometheus-stack, ServiceMonitor,
PrometheusRule) and Uptime-Kuma exist in the chart but are **disabled** in the `project-02`
overlay; enabling them is the monitoring batch in the roadmap.

---

## Security primitives (chart-level baseline)

Every pod applies:

- `securityContext.seccompProfile.type: RuntimeDefault` at pod level
- `allowPrivilegeEscalation: false`, `capabilities.drop: [ALL]` on every container
- `automountServiceAccountToken: false` (exception: Promtail, when monitoring is enabled)

Per-workload `runAsUser` / `readOnlyRootFilesystem` and the namespace's Pod Security
Standards (`baseline` enforce; `restricted` audit/warn) are unchanged from the chart; the
notable exemptions are the migration Job (runs as root, Debian-base aspnet image) and
Promtail (root, to read kubelet logs). NetworkPolicies and External Secrets Operator
support ship in the chart's `security/` templates.

---

## Operational notes

- **Mailer not deployed.** Backend is configured with `Smtp__Host=mailhog`, which isn't in
  the cluster — invite emails don't send (the rest of the app is unaffected). Fix is a
  mailer batch (Mailpit / transactional relay) in the roadmap.
- **Backend capped at 1 replica** by the RWO `longhorn` PVC; horizontal scaling needs
  object storage (roadmap).
- **kube-prometheus-stack CRDs are cluster-scoped** — relevant only when monitoring is
  enabled; don't `helm uninstall` carelessly on a shared cluster.

---

## Known follow-ups

All deferred deployment work — the Hetzner CD workflow, deleting the abandoned
`infrastructure/terraform/` + `infrastructure/nginx/` + duplicate realm export, fixing the
vestigial `values.yaml` `do-block-storage`/`ClusterIssuer` defaults, multi-environment
frontend build args, the mailer, monitoring, and Google sign-up onboarding — is tracked in
**[deployment-roadmap.md](./deployment-roadmap.md)**.
