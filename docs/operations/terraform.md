# Terraform — MyProperty infrastructure (M4.7)

Provisions DigitalOcean resources for the MyProperty production-shaped deployment.
The Terraform modules live in `infrastructure/terraform/`.

## Overview

| Resource | Managed by | Notes |
|---|---|---|
| DOKS cluster (`myproperty-cluster`) | Terraform — `cluster.tf` | fra1, K8s 1.34.8-do.0, 2× s-2vcpu-4gb |
| Managed Postgres 16 (`myproperty-db`) | Terraform — `database.tf` | fra1, db-s-1vcpu-1gb, single node |
| DB database `myproperty` | Terraform — `database.tf` | Created inside the managed cluster |
| DB user `myproperty_app` | Terraform — `database.tf` | Non-admin; DO generates the password |
| DB firewall (k8s rule) | Terraform — `database.tf` | Only the DOKS cluster can reach the DB |
| Spaces bucket: tfstate | Terraform — `bootstrap/` | Remote state for the main module |
| Spaces bucket: receipts | Terraform — `spaces.tf` | M5 file-storage migration path |
| Spaces access key | Terraform — `spaces.tf` | Scoped read/write to receipts bucket |
| Load Balancer | **Not Terraform** — auto-created by ingress-nginx | Managed by DOKS via `type: LoadBalancer` |
| DNS A records | **Not Terraform** — manual at Name.com | Three records after Phase 10 LB IP is known |
| ingress-nginx + cert-manager + ClusterIssuer | **Not Terraform** — manual `helm install` | One-shot cluster-scoped installs per runbook |
| Kubernetes Secrets | **Not Terraform** — `kubectl create secret` from Terraform outputs | Bootstrap runbook Step 7 in `k8s-deployment.md` |

**Consumer:** the Helm chart (`helm/myproperty`) deploys on top of the cluster and database
this module provisions. See [`docs/operations/k8s-deployment.md`](./k8s-deployment.md) for the
chart bootstrap runbook, including how Terraform outputs flow into Kubernetes Secrets.

---

## Cluster prerequisites

Everything you need on your laptop before running Terraform for the first time.

### Terraform ≥ 1.6

```bash
terraform --version
# Terraform v1.10.5 or later
```

Download from https://developer.hashicorp.com/terraform/install if not installed.

### doctl authenticated

```bash
doctl auth list
# should show at least one context with (current) marker
doctl account get
# should return your account email + status: active
```

Install and authenticate: `doctl auth init` with a DO PAT. The PAT used for `doctl` can be
the same one used for Terraform — it needs read+write scope on Kubernetes, Databases, and Spaces.

### DigitalOcean Personal Access Token (PAT)

Generate at https://cloud.digitalocean.com/account/api/tokens.

Required scopes (Custom token → enable Read + Write for):
- Kubernetes
- Databases
- Spaces
- Project (optional but useful)

The PAT goes into `terraform.tfvars` as `do_token`. The same value is stored as the
`DIGITALOCEAN_ACCESS_TOKEN` GitHub Actions secret for the CD workflow.

### Spaces access key pair

Generate at https://cloud.digitalocean.com/account/api/spaces. This is **separate** from
the PAT — DigitalOcean's S3-compatible object storage uses its own credential pair
(access key ID + secret key), not the API token.

You need two sets:
1. **Bootstrap module** — `spaces_access_id` + `spaces_secret_key` in `bootstrap/terraform.tfvars`. Used to create the state bucket.
2. **Main module** — same keys in `infrastructure/terraform/terraform.tfvars`. Used by the S3 backend to read/write remote state and by the provider to manage Spaces resources.

Both sets can be the same key pair if you generate one with broad scope. Store both halves
in your password manager — the secret key is shown once at generation time.

---

## File structure

```
infrastructure/terraform/
├── .gitignore                 — gitignores *.tfstate, .terraform/, terraform.tfvars, plan.bin
├── README.md                  — 5-line pointer to this doc
├── versions.tf                — required_providers, S3 backend block (bucket = bootstrap output)
├── variables.tf               — all input variables with defaults and descriptions
├── terraform.tfvars.example   — copy → terraform.tfvars and fill credentials
├── cluster.tf                 — digitalocean_kubernetes_cluster.myproperty
├── database.tf                — digitalocean_database_cluster + _db + _user + _firewall
├── spaces.tf                  — digitalocean_spaces_bucket.receipts + digitalocean_spaces_key.receipts
├── outputs.tf                 — cluster endpoint, DB private host/port/user/password, receipts bucket/key
└── bootstrap/
    ├── .gitignore             — same as parent; also gitignores .terraform.lock.hcl
    ├── README.md              — one-shot recipe for creating the state bucket
    ├── versions.tf            — same providers, NO backend block (local state by design)
    ├── variables.tf           — do_token, spaces_access_id, spaces_secret_key, region, bucket_name_prefix
    ├── terraform.tfvars.example
    └── main.tf                — random_id suffix + digitalocean_spaces_bucket.tfstate + outputs
```

---

## Variable strategy

### Why many small variables, not nested objects

Each variable maps to one configurable value (a region, a size slug, a name). Nested objects
look appealing but force you to override an entire block when you want to change one field.
Flat variables let `--set`-style overrides and `-var` flags work cleanly.

### Defaults vs required

| Variable | Default | Notes |
|---|---|---|
| `do_token` | — required | Never has a safe default |
| `spaces_access_id` | — required | Never has a safe default |
| `spaces_secret_key` | — required | Never has a safe default |
| `region` | `fra1` | Override only if you move the stack |
| `cluster_name` | `myproperty-cluster` | Matches CD workflow's `doctl kubeconfig save` arg |
| `cluster_version` | `1.34.8-do.0` | Bump explicitly, never via `auto_upgrade` |
| `cluster_node_size` | `s-2vcpu-4gb` | Get options with `doctl kubernetes options sizes` |
| `cluster_node_count` | `2` | Fixed pool — autoscaling off |
| `db_cluster_name` | `myproperty-db` | |
| `db_engine_version` | `16` | Must match in-cluster Postgres (EF migration parity) |
| `db_size` | `db-s-1vcpu-1gb` | Get options with `doctl databases options slugs --engine pg` |
| `db_name` | `myproperty` | |
| `db_user` | `myproperty_app` | Non-admin; doadmin is never used by the app |
| `spaces_bucket_prefix_receipts` | `myproperty-receipts` | Random 6-char hex suffix appended |

### The `terraform.tfvars` pattern

Copy `terraform.tfvars.example` to `terraform.tfvars`, fill in the three required credentials.
`terraform.tfvars` is gitignored — it must never be committed. The `.example` file is the
canonical credential template and is safe to commit.

---

## Secrets handling

Three distinct categories of secrets in this stack:

### 1. Terraform inputs — `terraform.tfvars` (gitignored)

`do_token`, `spaces_access_id`, `spaces_secret_key`. These are credentials Terraform needs
to authenticate to DigitalOcean. They live only in `terraform.tfvars` on your local disk.
They are never in Terraform state and never committed to git.

### 2. Terraform-managed outputs — remote state in Spaces

`db_password` and `receipts_secret_key` are generated by DigitalOcean at apply time and
stored in the remote Spaces bucket. Retrieve them with:

```bash
terraform output -raw db_password
terraform output -raw receipts_secret_key
terraform output -raw receipts_access_key_id
```

These values are `sensitive = true` — `terraform output` alone prints `<sensitive>`.
The `-raw` flag bypasses that for scripted use.

### 3. Kubernetes Secrets — in the cluster's etcd only

Created from Terraform outputs via the bootstrap runbook. Not in Terraform state, not in git.
The `myproperty-postgres` Secret holds `postgres-host`, `postgres-port`, `postgres-user`,
`postgres-password`, `postgres-db`. These are only in the cluster's etcd until the cluster
is destroyed. M4.8 follow-up replaces `kubectl create secret` with SealedSecrets or
external-secrets.

---

## Bootstrap recipe

Run this **once** per environment. If the cluster already exists, skip to
[Apply recipe (subsequent applies)](#apply-recipe-subsequent-applies).

### Step 1 — Generate credentials

1. Generate a DO PAT at https://cloud.digitalocean.com/account/api/tokens (Custom, Read+Write for Kubernetes + Databases + Spaces).
2. Generate a Spaces access key pair at https://cloud.digitalocean.com/account/api/spaces.
3. Save all three values in your password manager.
4. Store the PAT as the `DIGITALOCEAN_ACCESS_TOKEN` GitHub Actions secret (repo Settings → Secrets and variables → Actions).

### Step 2 — Create the state bucket

```bash
cd infrastructure/terraform/bootstrap
cp terraform.tfvars.example terraform.tfvars
# Fill in do_token, spaces_access_id, spaces_secret_key
terraform init
terraform plan -out=plan.bin
terraform apply plan.bin
BUCKET=$(terraform output -raw bucket_name)
echo "State bucket: $BUCKET"
```

Expected: `myproperty-tfstate-<6-char hex>` printed. Note this value — you need it in Step 3.

### Step 3 — Wire the state bucket into the main module

Two options (pick one):

**Option A — edit `versions.tf`** (makes the bucket name visible in the file):
Replace `REPLACE_WITH_BOOTSTRAP_OUTPUT` in `infrastructure/terraform/versions.tf`'s
`backend "s3"` block with the actual `$BUCKET` value. Then run `terraform init` from
`infrastructure/terraform/` to initialise the S3 backend before proceeding to Step 4.

**Option B — pass at init time** (keeps `versions.tf` clean, no code change):
```bash
# Export your Spaces credentials (the same pair used in bootstrap/terraform.tfvars)
export SPACES_ACCESS_ID="DOxxxxxxxxxxxxxxxxxx"
export SPACES_SECRET_KEY="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"

cd ../
terraform init -backend-config="bucket=$BUCKET" \
               -backend-config="access_key=$SPACES_ACCESS_ID" \
               -backend-config="secret_key=$SPACES_SECRET_KEY"
```

Option B is preferred — `versions.tf` stays committed as-is with the placeholder, and credentials
never touch a file.

### Step 4 — Apply the main module

```bash
cd infrastructure/terraform   # if not already there
cp terraform.tfvars.example terraform.tfvars
# Fill in do_token, spaces_access_id, spaces_secret_key
terraform plan -out=plan.bin
# Review the plan — expect 8 resources to create:
#   digitalocean_kubernetes_cluster.myproperty
#   digitalocean_database_cluster.myproperty
#   digitalocean_database_db.myproperty
#   digitalocean_database_user.myproperty
#   digitalocean_database_firewall.myproperty
#   random_id.receipts_suffix
#   digitalocean_spaces_bucket.receipts
#   digitalocean_spaces_key.receipts  (validated present in provider v2.87.0)
terraform apply plan.bin
```

Expected time: ~10 minutes. DOKS cluster takes ~3–5 min to reach `running`;
managed Postgres takes ~5 min to reach `online`.

### Step 5 — Capture outputs

```bash
terraform output -json > /tmp/tf.json
cat /tmp/tf.json | jq '{cluster_name, db_host, db_port, db_name, db_user}'
# Passwords are sensitive — retrieve separately:
terraform output -raw db_password
```

### Step 6 — Hand off to the K8s bootstrap runbook

Continue with [`docs/operations/k8s-deployment.md`](./k8s-deployment.md) § Bootstrap runbook,
starting from Step 0. That runbook consumes the Terraform outputs captured above.

---

## Apply recipe (subsequent applies)

Day-2 operations — changing a variable (e.g. bumping `cluster_version`) or adding a resource.

```bash
cd infrastructure/terraform
terraform plan -out=plan.bin
# Review the diff carefully before applying
terraform apply plan.bin
```

Always `plan` before `apply`. The plan shows exactly what will change, create, or destroy.
Destructive changes (node pool replacement, DB cluster recreation) are flagged with `-/+` or
`-` in the plan output — never apply these without understanding the impact.

---

## Teardown recipe

**Critical for cost control.** Each day with the cluster running costs ~$3.
Run this after submission to stop all billing within minutes.

Sequence matters — resources must be cleaned up in order to avoid orphaned volumes and
a failed `terraform destroy` on a bucket that still has objects.

### Step 1 — Uninstall the Helm release

```bash
helm uninstall myproperty -n myproperty
```

This removes the application workloads and Ingress resources. Note: the myproperty chart
only has `ClusterIP` Services — it does not own the DigitalOcean Load Balancer. The LB is
destroyed in Step 2.

### Step 2 — Uninstall ingress-nginx

```bash
helm uninstall ingress-nginx -n ingress-nginx
```

This removes the `ingress-nginx-controller` Service (type `LoadBalancer`), which signals
DOKS to destroy the DigitalOcean Load Balancer. Wait for the LB to disappear from the
DO console (~1 min) before proceeding — if you destroy the cluster while the LB deletion
is in flight, DO may leave an orphaned load balancer that keeps billing.

### Step 3 — Delete PVCs explicitly

`helm uninstall` does NOT delete PersistentVolumeClaims. Each PVC backs a DigitalOcean
block-storage volume billed at $0.10/GB/month. You must delete them manually:

```bash
kubectl delete pvc --all -n myproperty
# Then delete the namespaces for a full cluster cleanup.
# Note: cert-manager and ingress-nginx were installed manually (not by M4.7 Terraform),
# but they should be removed before terraform destroy to avoid admission-webhook timeouts.
kubectl delete ns myproperty ingress-nginx cert-manager
```

Wait for all three namespaces to disappear (`kubectl get ns`) before running
`terraform destroy`. If PVCs still exist when the cluster is destroyed, the underlying
volumes become orphaned and keep billing.

### Step 4 — Destroy the main module

```bash
cd infrastructure/terraform
terraform destroy
```

Expected: cluster, DB cluster, DB database, DB user, DB firewall, receipts bucket,
receipts key, random_id all destroyed. Confirm in the DO console that no Kubernetes
clusters or Databases remain.

**Note:** `terraform destroy` on a Spaces bucket fails if the bucket contains objects.
The receipts bucket starts empty; the state bucket (owned by `bootstrap/`) holds versioned
state files. If either destroy fails with "bucket not empty":
1. Go to the DO Spaces console, select the bucket, delete all objects and versions manually.
2. Re-run `terraform destroy`.

Do NOT add `force_destroy = true` to the state bucket — that would silently allow a stray
`apply` to wipe your entire Terraform state.

### Step 5 — Destroy the bootstrap module

```bash
cd infrastructure/terraform/bootstrap
terraform destroy
```

This deletes the state bucket. Only do this when fully done — destroying the state bucket
makes re-applying the main module impossible without re-bootstrapping from scratch.

---

## What's managed by Terraform vs what's manual

| Resource | Terraform? | Rationale |
|---|---|---|
| DOKS cluster | Yes | Core infra; version, size, region all captured in state |
| Managed Postgres | Yes | Real cloud resource for M4.7 deliverable; DO generates password, stored in state |
| Spaces tfstate bucket | Yes (bootstrap module) | Remote state; chicken-and-egg resolved by bootstrap's local state |
| Spaces receipts bucket | Yes | Pre-provisioned for M5 file-storage migration path |
| Spaces access key | Yes | Programmatic credentials for receipts bucket, output as sensitive |
| Load Balancer | No | Auto-created by DOKS when ingress-nginx installs a `type: LoadBalancer` Service; destroyed when the Service is deleted |
| DNS A records | No | Manual at Name.com; `namedotcom` provider is community-maintained with no HashiCorp backing — extra fragility on a deadline |
| ingress-nginx | No | Cluster-scoped one-shot; already documented in `k8s-deployment.md` bootstrap runbook |
| cert-manager + ClusterIssuer | No | Same rationale as ingress-nginx |
| Kubernetes Secrets | No | `kubernetes` Terraform provider introduces a circular dependency (cluster must exist before the provider can connect); bootstrap runbook pattern is simpler and the SealedSecrets path (M4.8) doesn't need Terraform at all |

---

## Integration handoff to M4.4 chart

After `terraform apply`, the bootstrap runbook creates the `myproperty-postgres` Secret
that the Helm chart reads. The exact command (sourcing values from Terraform outputs):

```bash
# Source Terraform outputs first (see bootstrap Step 5)
export DB_HOST=$(jq -r .db_host.value /tmp/tf.json)
export DB_PORT=$(jq -r .db_port.value /tmp/tf.json)
export DB_NAME=$(jq -r .db_name.value /tmp/tf.json)
export DB_USER=$(jq -r .db_user.value /tmp/tf.json)
export DB_PASSWORD=$(terraform output -raw db_password)

kubectl create secret generic myproperty-postgres \
  --from-literal=postgres-user="$DB_USER" \
  --from-literal=postgres-password="$DB_PASSWORD" \
  --from-literal=postgres-db="$DB_NAME" \
  --from-literal=postgres-host="$DB_HOST" \
  --from-literal=postgres-port="$DB_PORT" \
  --namespace myproperty
```

The Secret has **5 keys**: `postgres-user`, `postgres-password`, `postgres-db`,
`postgres-host`, `postgres-port`. The chart's backend Deployment and migration Job
read all five and construct the connection string:

```
Host=$(POSTGRES_HOST);Port=$(POSTGRES_PORT);Database=$(POSTGRES_DB);
Username=$(POSTGRES_USER);Password=$(POSTGRES_PASSWORD);
SSL Mode=Require;Trust Server Certificate=true
```

This is documented fully in [`docs/operations/k8s-deployment.md`](./k8s-deployment.md)
§ Bootstrap runbook, Step 7.

---

## Cost summary

| Resource | $/month | 5-day cost |
|---|---|---|
| DOKS cluster — 2× s-2vcpu-4gb nodes | $48 | ~$8 |
| Managed Postgres — db-s-1vcpu-1gb | $15 | ~$2.50 |
| Load Balancer (via ingress-nginx) | $12 | ~$2 |
| Spaces — tfstate bucket | $5/month flat (includes 250 GB storage + 1 TB transfer) | ~$0.80 |
| Spaces — receipts bucket | $5/month flat (includes 250 GB storage + 1 TB transfer) | ~$0.80 |
| Block storage PVCs (~50 GB total) | $5 | ~$0.80 |
| **Total** | **~$90** | **~$15** |

**Tear down after submission.** `terraform destroy` (main module) + `terraform destroy`
(bootstrap) stops billing within minutes. Confirm in the DO billing dashboard that
no active resources remain before logging off.

Each day after submission with the cluster running costs ~$3. A forgotten cluster runs
through the month at ~$90.

---

## Operational notes

### State drift

`terraform plan` detects manual changes made in the DO console (resizing the DB, adding a
node, renaming a cluster). The plan will show those as changes Terraform wants to revert.
**Never make manual changes to Terraform-managed resources through the DO console** — always
go through `terraform apply`. If drift occurs, run `terraform refresh` to update state, then
decide whether to accept or revert the manual change.

### Provider version pinning

The constraint `~> 2.46` allows any `2.x` version ≥ 2.46 but not 3.x. This prevents a
major-version bump (which may include breaking changes) from silently applying at `terraform init`.
The resolved version (`2.87.0` as of M4.7) is recorded in `.terraform.lock.hcl` — committed
to the repo so all team members and CI use the exact same provider binary.

### DB connection: private host vs public host

`outputs.tf` exposes `db_host` as `digitalocean_database_cluster.myproperty.private_host` —
the internal hostname reachable only from resources inside the same DO VPC (same region, same
default VPC). The public hostname (`host` attribute) works from the internet but adds latency
and requires more permissive firewall rules. Always use `private_host` from cluster workloads.

### PgBouncer pooling (port 25061) deliberately not used

DO managed Postgres exposes two ports: 25060 (direct) and 25061 (PgBouncer transaction
pooling). The backend uses Npgsql, which has its own connection pool. PgBouncer in transaction
mode breaks server-side cursors and prepared-statement features that EF Core relies on. No
benefit for a single-pod backend at demo traffic. Port 25060 is the right choice.

### SSL: `Trust Server Certificate=true`

DO managed Postgres requires TLS (cannot be disabled) and signs its server certificates with
a self-signed CA. The backend uses `SSL Mode=Require;Trust Server Certificate=true` — traffic
is encrypted but the CA is not validated. This is acceptable because traffic stays inside
DO's private network (same VPC, same region). Post-M4 follow-up: download DO's CA certificate
bundle, ship as a ConfigMap, mount into backend + migration-job pods, and switch to
`SSL Mode=VerifyFull;Root Certificate=/etc/ssl/certs/digitalocean-ca.crt`.

The same SSL flags are present in the connection string used against in-cluster Postgres
(when `postgres.enabled=true`). They are a no-op there because in-cluster Postgres has no
TLS configured — the connection falls back to plaintext silently.

### Default VPC sharing

Neither `cluster.tf` nor `database.tf` sets `vpc_uuid`. Both resources default to the
region's default VPC (`fra1` default VPC in this case). Because they share the same VPC,
the database firewall's `type = "k8s"` rule can reference the cluster by ID and DO routes
the traffic internally — no public hostname needed, no explicit VPC peering. If you ever
move one resource to a different VPC, the firewall rule will need updating and you will
need to switch to the public hostname.

---

## Known follow-ups

- **Replace `Trust Server Certificate=true` with proper CA cert validation.** Download DO's CA cert bundle, ship as a ConfigMap, mount into backend + migration-job pods, switch to `SSL Mode=VerifyFull;Root Certificate=/etc/ssl/certs/digitalocean-ca.crt`. Estimated 30–45 min; post-M4 hardening.
- **Backend file storage on DO Spaces.** M5 follow-up. Receipts bucket and access key already provisioned. M5 consumer reads `FileStorage__S3*` env vars from a new `myproperty-spaces` Secret populated from Terraform outputs.
- **Terraform-managed DNS via the `namedotcom` provider.** Three A records moved from manual Name.com into Terraform state when deadline pressure is gone.
- **Terraform-managed Kubernetes Secrets via the `kubernetes` provider.** Or SealedSecrets (M4.8 roadmap). Removes the `kubectl create secret` bootstrap step.
- **Terraform-managed `myproperty` namespace with pod-security labels.** The chart previously shipped `templates/namespace.yaml` as a Helm hook (`pre-install,pre-upgrade`); Helm's default `before-hook-creation` delete policy caused it to delete-and-recreate the existing namespace on every install, wiping all pre-created Secrets inside. Template was removed; install now relies on `--create-namespace` to create a bare namespace, and operators must apply `pod-security.kubernetes.io/{enforce=baseline,audit=restricted,warn=restricted}` by hand. Move to a `kubernetes_namespace` resource in Terraform (with labels declared in code) to eliminate the drift risk and the manual step.
- **Terraform-managed Postgres schema grants via the `postgresql` provider.** The app user (`digitalocean_database_user.myproperty`) is not the database owner; on PG 15+, non-owners cannot create objects in the `public` schema. First EF migration fails with `42501: permission denied for schema public`. Manual fix tonight: connect as `doadmin` via a throwaway in-cluster psql pod (firewall restricts external access) and run `GRANT ALL ON SCHEMA public TO <db_user>; ALTER SCHEMA public OWNER TO <db_user>;` against the app DB. Codify as `postgresql_grant` + `postgresql_schema` resources so a fresh `terraform apply` lands a working DB.
- **CD workflow short-SHA bug.** `.github/workflows/cd.yml` passes `${{ github.sha }}` (full 40-char SHA) to `--set <component>.image.tag`, but the CI workflows tag images with `SHORT_SHA=${GITHUB_SHA::7}` (7-char short SHA). Auto-deploys on push to `develop`/`main` have never been able to pull the images CI just published — every successful deploy must have been manual. Fix: compute `SHORT_SHA` in `cd.yml` and use it in the `--set` flags, OR additionally push the full-SHA tag from CI.
- **Init containers in `backend-deployment.yaml` and `keycloak-deployment.yaml` need explicit `runAsNonRoot: false` AND `runAsUser: 0`.** Pod-level securityContext sets `runAsNonRoot: true, runAsUser: 1654` (backend) / `1000` (keycloak). Init containers need root (`chown` for backend storage; `apk add gettext` for keycloak realm render). Setting only `runAsUser: 0` on the init container does not override the pod-level `runAsNonRoot: true` constraint — kubelet rejects with `container's runAsUser breaks non-root policy`. Both fields are required on the init container's securityContext. Same trap will catch any future init container in this chart.
- **Keycloak `KC_DB_URL` hardcoded to in-cluster Postgres.** Line 83 of `keycloak-deployment.yaml` reads `jdbc:postgresql://postgres:5432/keycloak`. When deploying with `postgres.enabled=false` (managed-PG mode), the keycloak Service has no in-cluster Postgres to resolve. Two paths: keep an in-cluster Postgres alongside managed for keycloak's separate DB, OR template `KC_DB_URL` from the `myproperty-postgres` Secret host/port and create a `keycloak` database in managed PG (with its own user + grants).
- **`terraform output -raw` is unsafe inside shell `$()` captures.** Terraform writes warnings/diagnostics to stdout (with ANSI color codes and box-drawing chars), which contaminates the captured value. Bootstrap shell snippets in this doc should standardize on `terraform output -json <name> | jq -r` — the JSON form never carries decoration. (Tonight: a contaminated `db_password` produced an Npgsql parser error at index 125 of the connection string.)
- **Pre-flight `terraform plan` in CI.** PR-level plan output as a PR comment. Catches state drift before merge.
- **`renovate` / Dependabot for the Terraform provider lockfile.** Auto-bump `digitalocean/digitalocean` minor versions.
- **CloudNativePG operator instead of managed Postgres.** Reverses the in-cluster vs managed direction; M5 question once multi-tenancy + backups + PITR matter operationally.
