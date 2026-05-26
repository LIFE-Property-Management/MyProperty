#!/usr/bin/env bash
# init-selfsigned.sh
#
# Generates a self-signed TLS cert into the Let's Encrypt directory layout
# so the production nginx config works unchanged in local dev. Cert covers
# the four subdomains the nginx vhost template serves
# (app.${MYPROPERTY_DOMAIN}, api.${MYPROPERTY_DOMAIN}, auth.${MYPROPERTY_DOMAIN},
# status.${MYPROPERTY_DOMAIN}).
#
# Run once after a clean clone (or after changing MYPROPERTY_DOMAIN):
#   ./infrastructure/nginx/init-selfsigned.sh
#
# The cert is written into the certbot_certs named volume the nginx and
# certbot services share — same path Let's Encrypt would produce
# (/etc/letsencrypt/live/<primary-domain>/fullchain.pem + privkey.pem).
#
# After running, add the same name to your browser/OS trust store if you
# want to avoid the cert-warning interstitial; alternatively just click
# through it in dev. The cert itself is a real X.509 + RSA chain, the
# only thing missing is a CA signature browsers trust by default.

set -euo pipefail

DOMAIN="${MYPROPERTY_DOMAIN:-myproperty.localhost}"
PRIMARY="app.${DOMAIN}"
VOLUME="myproperty_certbot_certs"
NETWORK="myproperty_myproperty-net"

echo "==> Self-signed cert init for ${DOMAIN}"
echo "    Cert SAN: app.${DOMAIN}, api.${DOMAIN}, auth.${DOMAIN}, status.${DOMAIN}"
echo "    Volume:   ${VOLUME}"
echo "    Path:     /etc/letsencrypt/live/${PRIMARY}/"
echo

# Ensure the named volume exists. `docker compose up` would create it on
# stack start, but we want to populate it before nginx looks at it.
docker volume create "${VOLUME}" > /dev/null

# Generate the cert inside an alpine container so we don't depend on the
# host having openssl installed.
docker run --rm \
  -v "${VOLUME}:/etc/letsencrypt" \
  alpine:3.20 sh -c "
    set -eu
    apk add --no-cache openssl > /dev/null
    mkdir -p /etc/letsencrypt/live/${PRIMARY}
    cd /etc/letsencrypt/live/${PRIMARY}

    cat > openssl.cnf <<EOF
[req]
default_bits       = 2048
prompt             = no
default_md         = sha256
distinguished_name = dn
req_extensions     = req_ext
x509_extensions    = v3_ext

[dn]
CN = ${PRIMARY}
O  = MyProperty Local Dev
C  = US

[req_ext]
subjectAltName = @san

[v3_ext]
subjectAltName    = @san
basicConstraints  = critical, CA:FALSE
keyUsage          = digitalSignature, keyEncipherment
extendedKeyUsage  = serverAuth

[san]
DNS.1 = ${PRIMARY}
DNS.2 = api.${DOMAIN}
DNS.3 = auth.${DOMAIN}
DNS.4 = status.${DOMAIN}
DNS.5 = ${DOMAIN}
EOF

    openssl req \
      -x509 -nodes -days 365 -newkey rsa:2048 \
      -keyout privkey.pem \
      -out fullchain.pem \
      -config openssl.cnf

    rm openssl.cnf
    chmod 644 fullchain.pem
    chmod 600 privkey.pem
    cp fullchain.pem chain.pem
    echo
    echo 'Generated:'
    ls -lh /etc/letsencrypt/live/${PRIMARY}/
  "

echo
echo "==> Done. Next steps:"
echo "    1. Add to /etc/hosts (or %WINDIR%/System32/drivers/etc/hosts on Windows):"
echo "         127.0.0.1  app.${DOMAIN}"
echo "         127.0.0.1  api.${DOMAIN}"
echo "         127.0.0.1  auth.${DOMAIN}"
echo "         127.0.0.1  status.${DOMAIN}"
echo
echo "    2. cp .env.proxy.example .env  (or merge into existing .env)"
echo "    3. docker compose --profile proxy up -d --build"
echo "    4. Open https://app.${DOMAIN}/ in your browser"
echo "       (accept the self-signed cert warning once)"
