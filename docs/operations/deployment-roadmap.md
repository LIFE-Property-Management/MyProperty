# Deployment Roadmap — deferred work

Single tracked source for deployment/infra work we have deliberately **deferred**. The
current live state is documented in [k8s-deployment.md](./k8s-deployment.md),
[ci-cd.md](./ci-cd.md), and [auth-flow.md](./auth-flow.md).

Context: MyProperty runs on a **shared Hetzner cluster** (namespace `project-02`) via
`helm/myproperty` + the manual `infrastructure/gjirafa/deploy.sh` loop. An earlier
DigitalOcean DOKS approach was abandoned but its artifacts and docs still linger; the
batches below clean that up and extend the platform.

---

## Batch 7 — Monitoring — ✅ DONE (2026-05-31)

Observability is live and namespace-scoped. See [k8s-deployment.md](./k8s-deployment.md)
for the operational detail. What shipped (no Prometheus operator / CRDs — the
kube-prometheus-stack dependency was replaced with self-contained manifests, since
the SA has no cluster-scoped permissions):

- In-namespace **Prometheus + Alertmanager + Grafana**, scraping the backend's metrics
  and loading alert rules directly (no `ServiceMonitor`/`PrometheusRule` CRDs).
- In-cluster **Loki** for logs; **Promtail** as a namespaced `Role` tailing only
  `project-02` pods.
- **Uptime-Kuma** on `status.myproperty.works` (4th subdomain + ingress), seeded with 13
  monitors + a public status page; data-store monitors inject real creds from Secrets.
- **AIOps webhook**: Alertmanager → Claude triage → **Discord** (`#alerts`), firing +
  resolved. Uptime-Kuma posts to a **separate** Discord channel (`#uptime`).

---

## Batch 8 — Google sign-up / onboarding & account auto-link

Google **sign-in** works. The gaps:

**Self-serve "Sign up with Google."** Today's sign-up
(`POST /api/v1/auth/register-landlord`) assigns the **Landlord realm role** and creates the
**Landlord domain entity**. A Google login goes through Keycloak's IdP flow and produces a
user with **neither** — so they authenticate, then dead-end (`decodePayload()` throws
"JWT has no recognized portal role"). Scope:

1. Backend provisioning endpoint — idempotently assign the Landlord role + create the
   Landlord entity for an authenticated-but-unprovisioned user (collect any landlord
   profile fields Google doesn't provide). **Landlord-scoped only** — tenants are
   invite-only (per `frontend/CLAUDE.md`), so this must not be a blanket default realm role.
2. Frontend onboarding state — handle the "no portal role yet" case instead of throwing in
   `decodePayload`/routing; render a "finish setting up your account" step that calls the
   endpoint, then routes to `/dashboard`. Add a "Continue with Google" button
   (`kc.login({ idpHint: "google" })`).
3. Keycloak — decide where role assignment lives (backend Admin REST vs a mapper/flow).
   `trustEmail: true` is already set on the Google IdP.

**Account auto-link (optional).** A landlord who signed up with email+password then tries
Google hits Keycloak's account-linking prompt (`idp-confirm-link`) — this is **expected**,
and "Add to existing account" + a one-time re-auth resolves it. To make it seamless, add a
custom first-broker-login flow using `idp-auto-link` (links by verified email; small
security trade-off, documented). Once Google sign-up exists, this prompt mostly disappears
for new users.

> **Gotcha:** editing `helm/myproperty/files/realm-export.template.json` does **not** update
> the already-running realm — Keycloak only imports a realm that doesn't exist yet. Apply
> realm changes to the live realm via the Admin Console/REST **and** update the template so
> fresh installs match.

---

## Batch 9 — CD rewrite + DOKS cleanup

The big de-DOKS pass. None of this is started; all of it is safe to do without touching the
running workloads.

### Build a real Hetzner CD workflow
- New GitHub Actions workflow: on push (or tag), `helm upgrade --install` against
  `project-02` using a **kubeconfig stored as a repo secret**, with short-SHA image tags.
  Replace/wrap the manual `infrastructure/gjirafa/deploy.sh` loop. (The dead DOKS `cd.yml`
  is already removed.)

### Delete abandoned artifacts
- `infrastructure/terraform/` — the entire DOKS stack (cluster, managed Postgres, Spaces,
  bootstrap state). Never applied against the current cluster.
- `infrastructure/nginx/` — standalone reverse-proxy/TLS scripts, replaced by the
  cluster's ingress-nginx + cert-manager.
- `infrastructure/keycloak/realm-export.template.json` — **duplicate** of
  `helm/myproperty/files/realm-export.template.json` (the Helm copy is the one actually
  used). Keep one source of truth.

### Fix vestigial Helm defaults — ✅ DONE (2026-05-31)
- `helm/myproperty/values.yaml` base defaults are now Hetzner-correct: `storageClassName:
  longhorn` (×8, was `do-block-storage`) and `issuerKind: Issuer` (namespaced, was
  `ClusterIssuer`). An un-overlaid deploy no longer references DO storage or a
  cluster-scoped Issuer the SA can't use. Stale `kube-prometheus-stack`/`ServiceMonitor`/
  `PrometheusRule` comments removed too.

### Frontend multi-environment build args
- `NEXT_PUBLIC_*` are baked at build time and hardcoded to prod in `frontend-ci.yml`.
  Parameterise via `workflow_dispatch` inputs for staging/prod (deferred per M4.4
  Decision #7).

### Security housekeeping
- ✅ **DONE (2026-05-31):** the DigitalOcean account was deleted, revoking the API token +
  Spaces key (which only existed in the local gitignored
  `infrastructure/terraform/**/terraform.tfvars`, never committed). Those local files have
  been scrubbed to `REVOKED` placeholders. The dead `infrastructure/terraform/` tree is
  removed as part of this batch's cleanup.

### Provider durability
- Ask Gjirafa whether the ingress entrypoint is a **stable** contractual address (floating
  IP / LB / wildcard hostname) vs the hardcoded 4 worker node IPs in DNS. A single VIP (one
  A record) or a CNAME would survive node-set changes; today's 12 A records go stale if
  nodes change.

### Mailer
- Invite emails don't send (`Smtp__Host=mailhog`, not deployed). Plan: Mailpit
  (axllent/mailpit) for capture and/or a transactional relay (SES/SendGrid/Mailgun/Resend).
  Config + secret only — the MailKit client already exists.

---

## Deferred: comprehensive documentation rewrite

This PR refreshed only the **current-reality** docs (`k8s-deployment.md`, `ci-cd.md`, the
new `auth-flow.md`) and left **SUPERSEDED banners** on the DOKS-era docs. The eventual goal
is to fully rewrite/retire the rest so the docs tree matches reality end to end:

- `docs/operations/terraform.md` — retire (no Terraform in the current path) or replace
  with a short "why we don't use Terraform" note.
- `docs/operations/nginx-ssl.md` — retire (ingress-nginx + cert-manager replace it).
- `docs/decisions/keycloak-prod-config.md` — reconcile with what M5 actually shipped.
- `docs/milestones/m4-deployment-ops.md` — historical; annotate the DOKS-vs-Hetzner pivot.
- `infrastructure/keycloak/PRODUCTION.md`, `infrastructure/nginx/PRODUCTION.md` — retire.
- `README.md` — currently empty; populate with project structure + how to run/deploy.
- `backend/CLAUDE.md` — the "Keycloak admin client deferred" note is now delivered (M5);
  refresh it.

Pairs naturally with Batch 9 (delete the artifacts and retire their docs together).
