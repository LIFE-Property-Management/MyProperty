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
# edit .secrets.env: GHCR_USERNAME, GHCR_PAT, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET,
#   ANTHROPIC_API_KEY, DISCORD_WEBHOOK_URL, DISCORD_UPTIME_WEBHOOK_URL (optional)
infrastructure/gjirafa/secrets.sh
```

`.secrets.env` is gitignored. The script **generates and persists** the random passwords
(Postgres, RabbitMQ, Keycloak admin, Keycloak DB, Redis, Grafana admin, Uptime-Kuma admin,
`myproperty-api` client secret) on first run and reuses them on re-runs — never regenerate
them by hand. It then applies these Secrets in `project-02`:

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
| `myproperty-grafana` | Grafana admin user/password |
| `myproperty-uptime-kuma` | Uptime-Kuma admin user/password |
| `myproperty-discord` | `webhook-url` (aiops #alerts) + `uptime-webhook-url` (Kuma #uptime) |

#### Rotating a data-store password

Postgres & RabbitMQ bake their password into the data volume on **first init only** —
changing the Secret on an existing volume does nothing to the live password. To rotate
by wiping (acceptable when the data is disposable): delete the password lines from
`.secrets.env`, re-run `secrets.sh`, delete the StatefulSets + their PVCs, then run
`deploy.sh --no-hooks` to recreate the stores fresh **before** a normal `deploy.sh` (the
migration runs as a pre-upgrade hook and needs Postgres already up). Redis is stateless —
just `rollout restart`, then `rollout restart` the backend + keycloak so they reconnect.

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
  (`createIssuers: true`, staging + prod), `monitoring.enabled: true`,
  `uptimeKuma.enabled: true`, and the **pinned image tags**.

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
| Deployment | backend, frontend, keycloak, redis, aiops-webhook, grafana |
| StatefulSet | postgres, rabbitmq, prometheus, alertmanager, loki, uptime-kuma |
| DaemonSet | promtail (namespaced log tailing) |
| Job | EF Core migration bundle (pre-upgrade hook); uptime-kuma seed (post-upgrade hook) |
| Service | postgres, redis, rabbitmq, keycloak, backend, frontend, prometheus, alertmanager, grafana, loki, aiops-webhook, uptime-kuma |
| Ingress | frontend (`app`), api (WebSocket timeouts), keycloak (`auth`), grafana (`grafana`), uptime-kuma (`status`) |
| Issuer | `letsencrypt-staging`, `letsencrypt-prod` (namespaced) |
| ConfigMap | postgres-init, keycloak-realm, prometheus/alertmanager/loki/promtail/grafana configs |
| PersistentVolumeClaim | backend storage (5Gi); StatefulSet PVCs: postgres (10Gi), rabbitmq (5Gi), prometheus (20Gi), alertmanager (1Gi), loki (10Gi), uptime-kuma (2Gi), grafana (2Gi) — all RWO `longhorn` |
| Secret | created out-of-band by `secrets.sh` (see above) |

The monitoring stack is **self-contained**: in-namespace Prometheus, Alertmanager, Grafana,
Loki, Promtail, Uptime-Kuma, and the AIOps webhook — all rendered by this chart. There is
**no Prometheus operator and no CRDs** (`ServiceMonitor`/`PrometheusRule`); Prometheus
scrapes via static config and loads alert rules from a ConfigMap. Gated by
`monitoring.enabled` + `uptimeKuma.enabled` (both **on** in the `project-02` overlay).

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

- **Email via Mailpit + Resend.** Backend and Keycloak send to the in-cluster `mailpit`
  service (`Smtp__Host=mailpit`, port 1025), which captures every message and relays it to
  **Resend** (587/STARTTLS) for real delivery. Relay creds live in the
  `myproperty-mailpit-relay` Secret; UI via `kubectl -n project-02 port-forward svc/mailpit 8025:8025`.
  See [`email-smtp.md`](./email-smtp.md).
- **Backend capped at 1 replica** by the RWO `longhorn` PVC; horizontal scaling needs
  object storage (roadmap). Same RWO constraint is why backend + Grafana use
  `strategy: Recreate` (a rolling update would deadlock on the single-attach volume).
- **Monitoring is fully namespace-scoped** — no cluster-scoped CRDs or operator, so it's
  safe on the shared cluster. Alerting flows Alertmanager → aiops-webhook → Claude →
  Discord (`#alerts`); Uptime-Kuma posts to a separate Discord channel (`#uptime`).

---

## Known follow-ups

All deferred deployment work — the Hetzner CD workflow, deleting the abandoned
`infrastructure/terraform/` + `infrastructure/nginx/` + duplicate realm export, fixing the
vestigial `values.yaml` `do-block-storage`/`ClusterIssuer` defaults, multi-environment
frontend build args, the mailer, monitoring, and Google sign-up onboarding — is tracked in
**[deployment-roadmap.md](./deployment-roadmap.md)**.
