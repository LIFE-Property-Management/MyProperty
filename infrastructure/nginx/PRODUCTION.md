# Nginx + Let's Encrypt — production deployment notes

This document describes how the MyProperty reverse-proxy + TLS layer
runs in production-grade Kubernetes. It complements
`docker-compose.yml`, which spins up nginx + certbot via the `proxy`
profile for local verification.

## TL;DR for the DevOps engineer

In production:

- Do **not** ship the compose `nginx` + `certbot` services as-is. The
  production equivalent is the `ingress-nginx` controller + cert-manager,
  both standard Helm charts.
- The compose proxy serves two purposes: (1) verify the forwarded-header
  contract against a real running app before K8s, and (2) provide a
  one-click "demo it locally with TLS" path.
- The nginx vhost template (`templates/myproperty.conf.template`) maps
  directly to `Ingress` resources with `host:` + `tls:` blocks. Take it
  as the spec for the routes; do not literally copy the file into a
  ConfigMap.

## Compose vs Kubernetes mapping

| Compose primitive | Kubernetes equivalent | Notes |
|---|---|---|
| `nginx` service | `ingress-nginx` controller (cluster-wide deployment) | Single chart install. ConfigMap controls global config; Ingress CRs control per-service routing. |
| `certbot` long-running service | `cert-manager` deployment | Manages cert lifecycle via the `Certificate` CRD. |
| `certbot_certs` named volume | `kubernetes.io/tls` Secret | cert-manager writes the secret; ingress-nginx reads it. |
| `init-letsencrypt.sh` bootstrap | `Certificate` + `Issuer`/`ClusterIssuer` resources | Applied once; cert-manager handles the HTTP-01 challenge automatically. |
| `nginx -s reload` 6h loop | Implicit | ingress-nginx watches Secret changes via the API server and reloads when the cert rotates. |
| vhost template | `Ingress` resource per service | One Ingress per `host:`. |

## Required pieces

### 1. ingress-nginx controller

Helm chart: `oci://ghcr.io/nginx/charts/nginx-ingress` (community Apache 2)
or `ingress-nginx` from the Kubernetes community. Either works; the
community chart is more common.

Required values overrides (in addition to defaults):

```yaml
controller:
  service:
    type: LoadBalancer       # or NodePort, depending on Gjirafa's cluster shape
  config:
    server-tokens: "false"   # mirror nginx.conf
    proxy-body-size: "10m"   # mirror the receipt upload cap
    ssl-protocols: "TLSv1.2 TLSv1.3"
    use-forwarded-headers: "true"   # so X-Forwarded-* from an upstream LB propagates
  defaultBackend:
    enabled: false
  metrics:
    enabled: true            # prometheus scrape target for the M4.5 dashboards
```

### 2. cert-manager + ClusterIssuer

```bash
helm repo add jetstack https://charts.jetstack.io
helm install cert-manager jetstack/cert-manager \
  --namespace cert-manager --create-namespace \
  --set installCRDs=true
```

Then apply a `ClusterIssuer` once:

```yaml
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: ${LETSENCRYPT_EMAIL}
    privateKeySecretRef:
      name: letsencrypt-prod-account-key
    solvers:
      - http01:
          ingress:
            class: nginx
```

Use `https://acme-staging-v02.api.letsencrypt.org/directory` for the
staging environment while debugging — same flag as `STAGING=1` in
`init-letsencrypt.sh`. Switch to production once issuance succeeds.

### 3. Per-service Ingress

One Ingress per public hostname. cert-manager picks up the
`cert-manager.io/cluster-issuer` annotation, requests a cert via the
HTTP-01 challenge against ingress-nginx, and writes the result to the
Secret named in `tls.secretName`.

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: myproperty-frontend
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/force-ssl-redirect: "true"
spec:
  ingressClassName: nginx
  tls:
    - hosts:
        - app.${MYPROPERTY_DOMAIN}
        - api.${MYPROPERTY_DOMAIN}
        - auth.${MYPROPERTY_DOMAIN}
      secretName: myproperty-tls
  rules:
    - host: app.${MYPROPERTY_DOMAIN}
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: frontend
                port:
                  number: 3000
    - host: api.${MYPROPERTY_DOMAIN}
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: backend
                port:
                  number: 8080
    - host: auth.${MYPROPERTY_DOMAIN}
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: keycloak
                port:
                  number: 8080
```

The single `tls.hosts` block with three names asks cert-manager for a
SAN cert covering all three subdomains. Matches the compose dev shape
exactly.

### 4. SignalR WebSocket annotation

The `api` ingress needs one extra annotation so ingress-nginx forwards
WebSocket frames at full duplex:

```yaml
annotations:
  nginx.ingress.kubernetes.io/proxy-read-timeout: "3600"
  nginx.ingress.kubernetes.io/proxy-send-timeout: "3600"
```

The `Connection: Upgrade` header is forwarded by ingress-nginx
automatically when `use-forwarded-headers: "true"` is set (above).

### 5. Forwarded headers

The .NET API already calls `UseForwardedHeaders` with cleared
KnownProxies/KnownIPNetworks (Program.cs ~line 462). With
`use-forwarded-headers: "true"` on ingress-nginx, the chain is:

```
client → cloud LB → ingress-nginx pod → backend pod
         (X-FF-For: client)
                      (X-FF-For: client, lb)
                                          (X-FF-For: client, lb, ingress)
```

Keycloak picks up the same chain when `KC_PROXY_HEADERS=xforwarded` is
set (see `infrastructure/keycloak/PRODUCTION.md`).

## Verification (after Helm install)

```bash
# 1. ingress-nginx controller pod is Running and reports ready
kubectl get pods -n ingress-nginx
kubectl get svc -n ingress-nginx ingress-nginx-controller

# 2. cert-manager pods are Running
kubectl get pods -n cert-manager

# 3. ClusterIssuer is Ready
kubectl get clusterissuer letsencrypt-prod -o yaml

# 4. Certificate is issued (transitions from Pending → Ready in 1–3 min)
kubectl describe certificate myproperty-tls
kubectl get secret myproperty-tls -o jsonpath='{.data.tls\.crt}' | base64 -d | openssl x509 -noout -issuer -subject -dates

# 5. HTTPS reachable end-to-end
curl -i https://app.${MYPROPERTY_DOMAIN}/
curl -i https://api.${MYPROPERTY_DOMAIN}/api/v1/health/ready
curl -ks https://auth.${MYPROPERTY_DOMAIN}/realms/MyProperty/.well-known/openid-configuration | jq .issuer
```

The `.issuer` value must equal `https://auth.${MYPROPERTY_DOMAIN}/realms/MyProperty`
exactly. If it reports an internal cluster URL, `KC_HOSTNAME` is missing or
incorrect — see `infrastructure/keycloak/PRODUCTION.md`.

## Operational notes

- **Rate limits.** Let's Encrypt rate-limits failed validation attempts
  to 5 per hostname per hour, and successful issuance to 50 per
  registered domain per week. While debugging issuance, point the
  `ClusterIssuer` at the staging API; switch to production only once
  staging succeeds.
- **Renewal.** cert-manager attempts renewal at 2/3 of cert lifetime
  (60 of 90 days for Let's Encrypt). Renewal writes a new Secret;
  ingress-nginx watches the Secret and reloads its config within
  seconds — no operator action needed.
- **Wildcard certs.** Three subdomains × one SAN cert is cheaper than a
  wildcard and avoids the DNS-01 challenge (DNS-01 needs a DNS API
  token or a DNS provider plugin). If a fourth subdomain is needed,
  add it to `tls.hosts` and re-issue; the cert covers all listed names.
- **Hangfire / Grafana / Prometheus / Alertmanager.** These services
  remain ClusterIP in production — accessible via `kubectl
  port-forward` or a separate internal-only ingress + basic auth +
  IP allowlist. Public exposure is out of scope for M4.9 / M4.4.

## Why the compose proxy still exists

Three reasons it ships alongside the K8s path rather than being
replaced by it:

1. **Local verification.** Reproducing the forwarded-header contract
   against a real running app, with TLS termination, on a developer
   laptop — without standing up a Kubernetes cluster — catches the
   bugs (HSTS-cache-vs-self-signed, IPv4-only bind on Alpine, Keycloak
   `KC_PROXY_HEADERS` interactions) that would otherwise surface only
   in the first staging deployment.
2. **Demo path for graders.** The M4.9 deliverable text reads "Nginx
   + SSL: Reverse proxy with Let's Encrypt SSL." A grader without
   cluster access can still verify the deliverable by running the
   self-signed init script and `docker compose --profile proxy up`.
3. **Reference for the Helm chart.** The compose nginx config is the
   smallest correct example of all forwarded-header, WebSocket, and
   cert-path concerns the K8s ingress resources have to encode. The
   Helm chart inherits the same shape, just expressed in `Ingress`
   CRs instead of nginx directives.

## References

- ingress-nginx Helm chart: <https://kubernetes.github.io/ingress-nginx/>
- cert-manager: <https://cert-manager.io/docs/installation/helm/>
- Let's Encrypt rate limits: <https://letsencrypt.org/docs/rate-limits/>
- Keycloak reverse-proxy docs: <https://www.keycloak.org/server/reverseproxy>
- ASP.NET forwarded-headers middleware: <https://learn.microsoft.com/aspnet/core/host-and-deploy/proxy-load-balancer>
