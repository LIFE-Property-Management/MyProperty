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

## Batch 9 — CD rewrite + DOKS cleanup — ✅ MOSTLY DONE (2026-06-01)

The big de-DOKS pass. Shipped in the `feature/hetzner-cd` branch (PR #128); the CD pipeline is
documented in [ci-cd.md](./ci-cd.md).

### Build a real Hetzner CD workflow — ✅ DONE (pending first live run)
- `.github/workflows/cd.yml` ships: `workflow_run` (the four image-CI workflows) +
  `workflow_dispatch` → per-component GHCR tag resolution → format-preserving auto-commit
  bump → `deploy.sh --atomic --cleanup-on-fail` against `project-02` (kubeconfig as a
  **`project-02` Environment secret**) → health gate → Discord failure notice. Behind a
  manual approval Environment; serialized; `GITHUB_TOKEN` push. Also added
  `uptime-kuma-init-ci.yml` to close the seed-image CI gap. See [ci-cd.md](./ci-cd.md).
  ⚠️ Statically validated only — the first **live** `CI → approval → deploy → rollback` run
  is still pending (needs `cd.yml` on `develop`).

### Delete abandoned artifacts — ⚠️ SCOPE CORRECTED
- ✅ `infrastructure/terraform/` — **DELETED** (entire DOKS stack; never applied; DO account
  revoked; no tfstate/real tfvars tracked; no functional refs).
- ❌ `infrastructure/nginx/` — **KEPT.** Not abandoned: it backs the docker-compose `proxy`
  profile (`docker compose --profile proxy up` → host 80/443 + subdomain routing + certbot
  TLS). "Replaced by ingress-nginx" holds only for **K8s**; deleting it breaks local HTTPS dev.
- ❌ `infrastructure/keycloak/realm-export.template.json` — **KEPT.** Not a dead duplicate: it
  is the source the compose **default-stack** `keycloak-realm-init` service renders (envsubst →
  import volume). Byte-identical to the Helm copy today, but compose reads this path; deleting
  it breaks `docker compose up`. (Future: a single source of truth would require pointing
  compose at the Helm copy — deferred, not a deletion.)

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

- ✅ `docs/operations/terraform.md` — **RETIRED** (replaced with a short tombstone; the
  Terraform tree is deleted).
- ❌ `docs/operations/nginx-ssl.md` — **KEPT** (documents the still-live docker-compose `proxy`
  profile; not retired — see the scope correction in Batch 9 above).
- `docs/decisions/keycloak-prod-config.md` — reconcile with what M5 actually shipped. *(open)*
- `docs/milestones/m4-deployment-ops.md` — historical; annotate the DOKS-vs-Hetzner pivot. *(open)*
- ❌ `infrastructure/keycloak/PRODUCTION.md`, `infrastructure/nginx/PRODUCTION.md` — **KEPT**
  (both document features still in use locally; keycloak banner's stale "duplicate/dedup" line
  corrected). Not retired.
- `README.md` — currently empty; populate with project structure + how to run/deploy. *(open)*
- `backend/CLAUDE.md` — the "Keycloak admin client deferred" note is now delivered (M5);
  refresh it. *(open)*

Most of Batch 9 landed with the CD work; remaining items above are the only open doc tasks.
