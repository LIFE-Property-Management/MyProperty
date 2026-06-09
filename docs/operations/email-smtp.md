# Email & SMTP — Mailpit + Resend

How MyProperty sends transactional email (invites, password resets, payment
confirmations) in local dev and in the `project-02` cluster.

## Architecture

```
LOCAL (docker compose)            CLUSTER (project-02)
──────────────────────            ────────────────────────────────────────────
backend ─┐                        backend ─┐
keycloak ┼─SMTP 1025─► mailpit    keycloak ┼─SMTP 1025─► mailpit (StatefulSet, 1Gi PVC)
         │   (catcher)            uptime-kuma┘  │ capture copy   └─ relay 587 ─► Resend ─► inbox
   view ◄┘   UI :8025                  port-fwd │ UI :8025          (STARTTLS, auth        (SPF/DKIM/DMARC
                                                ▼                    from Secret)           on myproperty.works)
                                    Prometheus /metrics · Promtail→Loki · Uptime-Kuma probe
```

- **Mailpit** (`axllent/mailpit:v1.30.1`) is the single SMTP endpoint. MailKit
  (`MailKitEmailSender`) and Keycloak both connect on port **1025**.
- **Local dev:** pure catcher. Mail stays in the UI at <http://localhost:8025>; nothing
  leaves the machine (no relay configured in `docker-compose.yml`).
- **Cluster:** Mailpit captures a viewable copy **and** relays every message to **Resend**
  (`smtp.resend.com:587`, STARTTLS, auto-relay-all) for real delivery.

## Local dev

`docker compose up -d mailpit` — UI at <http://localhost:8025>. The backend points at
`Smtp__Host=mailpit`; Keycloak's realm template SMTP host is `mailpit`. No relay, no creds.

## Cluster

### Chart

- StatefulSet + Service: `helm/myproperty/templates/data/mailpit-{statefulset,service}.yaml`
  (runs non-root uid 1000, `/data` PVC, probes on `/livez` + `/readyz`).
- Values: `mailpit.*` in `values.yaml`; enabled (with relay + metrics) in `values-gjirafa.yaml`.
- Relay env (`MP_SMTP_RELAY_*`) renders only when `mailpit.relay.enabled`. Note: these env
  vars work in v1.30.1 even though they aren't in `mailpit --help` (which lists only
  `--smtp-relay-config`). `MP_SMTP_RELAY_AUTH` **must** be set (default `none`) or Resend
  rejects the unauthenticated message.

### Relay secret (Resend)

Created **only** by `infrastructure/gjirafa/secrets.sh` (never `kubectl create secret`):

```bash
# in infrastructure/gjirafa/.secrets.env (gitignored — never commit):
MAILPIT_RELAY_PASSWORD="re_your_resend_api_key"   # username defaults to "resend"
# then:
./infrastructure/gjirafa/secrets.sh
# verify:
kubectl --kubeconfig project-02.kubeconfig -n project-02 get secret myproperty-mailpit-relay
```

Secret `myproperty-mailpit-relay` has keys `relay-username` (`resend`) + `relay-password`
(the Resend API key), consumed by the StatefulSet via `secretKeyRef`.

### Deploy

```bash
./infrastructure/gjirafa/deploy.sh
```

(`values-gjirafa.yaml` carries `mailpit.relay.enabled: true`, `relay.host: smtp.resend.com`,
and `mailpit.metrics.enabled: true`, so a plain deploy keeps the relay + metrics on.)

### Viewing captured mail

No Ingress — internal only. Use a port-forward:

```bash
kubectl --kubeconfig project-02.kubeconfig -n project-02 port-forward svc/mailpit 8025:8025
# open http://localhost:8025
```

## NetworkPolicies

`networkPolicies.enabled: true` (Calico, default-deny). The relevant rules
(`templates/security/networkpolicies.yaml`, all gated on `mailpit.enabled`):

- **mailpit** policy: ingress 1025 from `backend` + `keycloak`; egress 587 to public IPs
  (Resend relay). Prometheus-scrape + Kuma-probe ingress come from the catch-all policies;
  DNS egress from `allow-dns-egress`.
- **backend** + **keycloak** egress each gain a rule to `mailpit:1025`.
- **prometheus** egress gains a rule to `mailpit:9090` (the metrics port) — without it the
  scrape times out even though the catch-all allows the ingress side.

## Keycloak live-realm SMTP

Realm import runs **only on Keycloak's first boot** — editing the realm template does **not**
change the already-running realm. The live `project-02` realm predated the password-reset
feature, so it shipped with an empty `smtpServer` and `resetPasswordAllowed: false`. Fixed
via `kcadm` against the running realm (authenticating with the pod's own
`$KEYCLOAK_ADMIN`/`$KEYCLOAK_ADMIN_PASSWORD` env so secrets never leave the pod):

```bash
kubectl -n project-02 exec -i deploy/myproperty-keycloak -- bash -s <<'EOF'
K=/opt/keycloak/bin/kcadm.sh
"$K" config credentials --server http://localhost:8080 --realm master \
  --user "$KEYCLOAK_ADMIN" --password "$KEYCLOAK_ADMIN_PASSWORD" --config /tmp/kc.cfg
"$K" update realms/MyProperty --config /tmp/kc.cfg -s resetPasswordAllowed=true
cat > /tmp/smtp.json <<'JSON'
{"smtpServer":{"host":"mailpit","port":"1025","from":"no-reply@myproperty.works","fromDisplayName":"MyProperty","ssl":"false","starttls":"false","auth":"false"}}
JSON
"$K" update realms/MyProperty --config /tmp/kc.cfg -f /tmp/smtp.json
rm -f /tmp/kc.cfg /tmp/smtp.json
EOF
```

**Gotcha:** the nested `smtpServer` map will **not** persist via `-s smtpServer.host=...`
(or even `-s 'smtpServer={json}'`) — both silently no-op. Set it from a file with
`update ... -f <file>`. Scalars like `resetPasswordAllowed` do work with `-s`.

## Monitoring

- **Prometheus:** scrape job `mailpit` → `mailpit:9090/metrics` (enabled by
  `mailpit.metrics.enabled`). Metrics: `mailpit_messages`, `mailpit_smtp_accepted_total`,
  `mailpit_smtp_rejected_total`, `mailpit_database_size_bytes`, etc.
- **Alerts** (`prometheus-rules-configmap.yaml`): `MailpitDown` (`up{job="mailpit"}==0`,
  critical) and `MailpitRejectingMail` (rejected-counter, warning). **Mailpit exposes no
  relay-success/failure metric** — relay errors appear only in its **logs** (Loki), so a
  quiet log + `MailpitDown` inactive = healthy.
- **Grafana:** dashboard `files/dashboard-mailpit.json` ("Mailpit — Email Delivery").
- **Uptime-Kuma:** an HTTP monitor on `http://mailpit:8025/livez` is in `monitors.json`. It
  appears in the live Kuma only after the seed image (`uptimeKuma.seedImage`) is rebuilt —
  `monitors.json` is **baked into that image** (CI bumps the tag on merge). Kuma's
  `Email (oncall)` notification is wired to `mailpit:1025` via `uptimeKuma.smtp.*` (env-driven,
  applied by the seed Job each deploy), so Kuma's own alert emails relay out through Resend.
- **Loki:** Mailpit stdout ships automatically (Promtail DaemonSet), labelled
  `component=mailpit`.

## Deliverability

Resend signs with DKIM (`resend._domainkey.myproperty.works`) and SPF on the `send.`
subdomain; DMARC is `p=none`. Confirm on a received message via Gmail → **Show original** →
`Authentication-Results` (expect `dkim=pass header.i=@myproperty.works`, `spf=pass`,
`dmarc=pass`). New sending domains land in spam until reputation builds — "Report not spam"
trains the recipient; this is reputation, not misconfiguration.

## Rollback

- Stop sending, keep capture: `mailpit.relay.enabled: false` + `deploy.sh`.
- Remove Mailpit entirely: `mailpit.enabled: false` + `deploy.sh` (Secret + PVC persist).
- Backend `Smtp__Host` / NetworkPolicy edits: revert via git + redeploy.
- Live-realm SMTP: revert with `kcadm update realms/MyProperty -f` an empty `smtpServer`.
- NetworkPolicy escape hatch: `kubectl -n project-02 delete networkpolicy --all`.
