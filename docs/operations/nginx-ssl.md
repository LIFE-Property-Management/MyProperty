# Nginx + Let's Encrypt SSL (M4.9)

> ⚠️ **SUPERSEDED.** This describes a standalone nginx reverse-proxy + TLS layer that is
> **not used** on the current cluster — the cluster-provided **ingress-nginx** controller
> and **cert-manager** handle ingress and TLS (namespaced `Issuer`s). See
> [k8s-deployment.md](./k8s-deployment.md). Retirement tracked in
> [deployment-roadmap.md](./deployment-roadmap.md).

This document describes MyProperty's reverse-proxy + TLS termination layer
as of M4.9 (2026-05-21). The proxy is **opt-in** via a Docker Compose
profile so the default `docker compose up` keeps the existing
localhost:port behaviour referenced throughout `.env.example` and the
operations docs.

## Overview

Nginx (1.27-alpine) terminates TLS on host ports 80/443 and routes by
subdomain into the existing service network:

| Public hostname | Backing service | Notes |
|---|---|---|
| `app.${MYPROPERTY_DOMAIN}` | `frontend:3000` (Next.js) | Static + SSR bundle |
| `api.${MYPROPERTY_DOMAIN}` | `backend:8080` (.NET API) | WebSocket upgrade enabled for `/hubs/notifications` (SignalR) |
| `auth.${MYPROPERTY_DOMAIN}` | `keycloak:8080` | Admin console + OIDC endpoints |

A single SAN certificate covers all three subdomains. The primary name
is `app.${MYPROPERTY_DOMAIN}` and the cert is read from
`/etc/letsencrypt/live/app.${MYPROPERTY_DOMAIN}/{fullchain,privkey}.pem`
— the canonical certbot output path. The same nginx config is used in
dev (self-signed) and prod (Let's Encrypt) because both init scripts
park the cert at that identical path.

## Activation

```bash
# 1. Populate the cert volume (one-time, per environment)
./infrastructure/nginx/init-selfsigned.sh        # local dev
# or
MYPROPERTY_DOMAIN=mydomain.example \
LETSENCRYPT_EMAIL=admin@mydomain.example \
  ./infrastructure/nginx/init-letsencrypt.sh     # production

# 2. Bring the proxy profile up
cp .env.proxy.example .env                       # or merge into existing .env
docker compose --profile proxy up -d --build
```

The `--profile proxy` flag adds two services on top of the default stack:

- **nginx** — host ports 80 + 443, bind-mounted config from
  `infrastructure/nginx/`. Reloads itself every 6h via a `command` wrapper
  so renewed certs from the certbot service are picked up automatically.
- **certbot** — long-running container that runs `certbot renew --webroot`
  every 12h. Renewal is a no-op until certs are within 30 days of
  expiry.

Without the profile, the original ports (3000, 5042, 8080, …) stay
exposed on the host exactly as they were in M4.1. The proxy is purely
additive.

## SSL strategy

### Local development — self-signed

`infrastructure/nginx/init-selfsigned.sh` generates an RSA-2048
certificate inside an `alpine:3.20` container(no host openssl
dependency) and writes it into the same `certbot_certs` named volume
the production path uses. SAN entries cover all three subdomains plus
the root domain.

Browsers will show a cert-warning interstitial until the local CA is
trusted; in dev that's acceptable — click through once per browser
profile. The cert itself is a real X.509 chain, only the signature is
untrusted.

Recommended `/etc/hosts` additions (or `%WINDIR%\System32\drivers\etc\hosts`
on Windows):

```
127.0.0.1   app.myproperty.localhost
127.0.0.1   api.myproperty.localhost
127.0.0.1   auth.myproperty.localhost
```

### Production — Let's Encrypt

`infrastructure/nginx/init-letsencrypt.sh` automates the
"chicken-and-egg" bootstrap: nginx cannot start without a cert at the
configured path, and certbot cannot complete the HTTP-01 challenge
without nginx serving on port 80. The script:

1. Writes a 1-day dummy self-signed cert at the real path.
2. Starts nginx with the dummy cert (so port 80 is reachable for the
   ACME challenge).
3. Removes the dummy and runs `certbot certonly --webroot` for the
   three subdomains.
4. Reloads nginx to pick up the real cert.

Required inputs (via environment):

| Variable | Purpose |
|---|---|
| `MYPROPERTY_DOMAIN` | Base domain — three subdomains served below it. |
| `LETSENCRYPT_EMAIL` | Contact address Let's Encrypt sends expiry warnings to. |
| `STAGING=1` (optional) | Use Let's Encrypt's staging API while debugging. Staging certs are untrusted but have much higher rate limits — flip on before flipping off; the production API rate-limits failed validations to 5/hour/hostname. |

After issuance the certbot service handles renewal automatically (12h
sleep loop). The nginx service reloads its config every 6h so renewed
certs are served within ~18h of renewal at worst — well inside the
30-day buffer Let's Encrypt provides.

## Forwarded headers

The proxy sets the standard chain on every upstream request:

```
proxy_set_header Host              $host;
proxy_set_header X-Real-IP         $remote_addr;
proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto https;
proxy_set_header X-Forwarded-Host  $host;
```

On the backend side these are consumed by ASP.NET's
`UseForwardedHeaders` middleware (configured in `Program.cs` ~lines
443–462). The middleware's `KnownProxies` / `KnownIPNetworks` lists are
cleared deliberately — the trust boundary is the container network. The
only way a header can reach the API is via this proxy or, in K8s, the
ingress controller.

On Keycloak the headers are read when `KC_PROXY_HEADERS=xforwarded` is
set. The production-mode env block in
`infrastructure/keycloak/PRODUCTION.md` enables it; dev (`start-dev`) is
lenient enough that Keycloak works without the flag, so the local dev
proxy demo runs without that env override.

## WebSocket upgrades (SignalR)

`api.${MYPROPERTY_DOMAIN}/hubs/notifications` carries the SignalR
WebSocket connection. The `Connection: Upgrade` / `Upgrade: websocket`
headers are forwarded conditionally via the standard `map` directive in
`nginx.conf`. Without the map, idle WebSocket connections would drop
every ~100 s on nginx's default `proxy_read_timeout`; the api server
block extends that to 1 h to match SignalR's default keepalive interval.

## Security headers

Every HTTPS server block sets:

- `X-Content-Type-Options: nosniff` — disables MIME sniffing.
- `Referrer-Policy: strict-origin-when-cross-origin` — limits Referer
  leakage on outbound nav.
- `X-Frame-Options: SAMEORIGIN` (frontend only) — clickjacking baseline.

`Strict-Transport-Security` (HSTS) is **commented out** because it sticks
in browser caches indefinitely after the first response, even when the
cert is self-signed. Flip it on once the deployment is on a real domain
with Let's Encrypt — the line is one uncomment away in
`infrastructure/nginx/templates/myproperty.conf.template`.

`server_tokens off` in `nginx.conf` hides the nginx version from error
pages and the `Server` response header.

## Upload size cap

`client_max_body_size 10m` in the http block (and restated on the api
vhost for grep-ability). The full chain of limits:

| Layer | Limit | What happens on overflow |
|---|---|---|
| FluentValidation (`SubmitPaymentValidator`) | 5 MB | 400 ValidationProblemDetails |
| Kestrel `[RequestSizeLimit]` | 6 MB | 413 Request Entity Too Large from the API |
| Nginx `client_max_body_size` | 10 MB | 413 from nginx, never reaches API |

The 4 MB headroom between Kestrel and nginx exists so denied uploads
return the application's specific error rather than nginx's generic
413 page.

## Verification

After running the activation steps:

```bash
# HTTP → HTTPS redirect (no -L; we want to see the 301)
curl -i http://app.myproperty.localhost/             # 301 → https://app...

# HTTPS frontend (-k accepts self-signed)
curl -ki https://app.myproperty.localhost/           # 200 + Next.js HTML

# HTTPS backend via the proxy
curl -ki https://api.myproperty.localhost/api/v1/health/live      # 200
curl -ki https://api.myproperty.localhost/api/v1/health/ready     # 200
curl -ki https://api.myproperty.localhost/api/v1/health/diagnostics  # 200 (all healthy)

# Keycloak realm well-known — issuer must match KC_HOSTNAME
curl -ks https://auth.myproperty.localhost/realms/MyProperty/.well-known/openid-configuration | jq .issuer
# Expected: "https://auth.myproperty.localhost/realms/MyProperty" (with KC_HOSTNAME set)
# In start-dev mode without KC_HOSTNAME the issuer follows whatever the
# proxy forwarded; documented in infrastructure/keycloak/PRODUCTION.md.

# Forwarded headers reaching the API (request log line via docker compose logs backend)
docker compose --profile proxy logs --tail=20 backend | grep -i "https\|forwarded"

# Cert details
docker compose --profile proxy run --rm --entrypoint sh certbot \
  -c "openssl x509 -in /etc/letsencrypt/live/app.myproperty.localhost/fullchain.pem -noout -issuer -subject -dates"
```

## Renewal architecture

```
                    ┌────────────────────────────────────┐
                    │ certbot container                  │
                    │  while :; do                       │
                    │    certbot renew --webroot ...     │  every 12h
                    │    sleep 12h                       │
                    │  done                              │
                    └─────────────┬──────────────────────┘
                                  │ writes
                                  ▼
                    ┌────────────────────────────────────┐
                    │ certbot_certs (named volume)       │
                    │   /etc/letsencrypt/live/.../*.pem  │
                    └─────────────┬──────────────────────┘
                                  │ read-only mount
                                  ▼
                    ┌────────────────────────────────────┐
                    │ nginx container                    │
                    │  while :; do                       │
                    │    sleep 6h; nginx -s reload       │  every 6h
                    │  done & nginx -g 'daemon off;'     │
                    └────────────────────────────────────┘
```

Both loops are bounded: cert files are owned exclusively by certbot,
nginx reads them at config-load time. Worst-case staleness after a
renewal is the nginx reload interval (~6 h), well inside Let's
Encrypt's 30-day expiry buffer.

## Kubernetes mapping (M4.4 follow-up)

The compose proxy is the prod-shape primitive in miniature. In the M4.4
Helm chart the equivalents are:

| Compose | Kubernetes |
|---|---|
| `nginx` service | `ingress-nginx` controller (cluster-wide deployment) |
| `certbot` service | `cert-manager` deployment + `ClusterIssuer`/`Issuer` CRDs |
| `certbot_certs` volume | TLS Secret managed by cert-manager |
| `init-letsencrypt.sh` bootstrap | `Certificate` resource auto-issues on first apply |
| `nginx -s reload` loop | cert-manager updates the Secret; ingress-nginx watches Secret changes and reloads automatically |
| Vhost template | `Ingress` resource per service with `host:` + `tls:` blocks |

`infrastructure/nginx/PRODUCTION.md` has the full mapping with an
example `Ingress` + `Certificate` manifest.

## Operational notes

- **`docker compose down` keeps certs.** The `certbot_certs` named
  volume is preserved across stack restarts. Use
  `docker compose down -v` or `./scripts/reset-dev-stack.sh` to wipe
  certs; re-run the init script after.
- **`HSTS` and self-signed certs don't mix.** A browser that accepts an
  HSTS header from a self-signed cert will refuse to fall back to
  plain HTTP even after the cert is removed, until the HSTS cache
  expires (one year by default). Keep the HSTS line commented out in
  dev; uncomment only in environments served by Let's Encrypt.
- **`nginx -t` before reload.** The 6h reload loop assumes the config
  is valid. After editing
  `infrastructure/nginx/templates/myproperty.conf.template`, run
  `docker compose --profile proxy exec nginx nginx -t` once to validate
  before the next reload picks up the new template.
- **Hangfire / Grafana / Prometheus / Alertmanager are not proxied by
  default.** The dev compose still binds them to host ports for direct
  access (3001/9090/9093/15672). In production they should sit behind
  basic auth + an IP allowlist on a separate ingress; out of scope for
  M4.9, tracked alongside M4.4's ingress hardening pass.
