#!/usr/bin/env bash
# init-letsencrypt.sh
#
# First-time Let's Encrypt cert issuance for the nginx reverse proxy.
# Run once per fresh deployment after DNS is pointing at the host and
# ports 80/443 are reachable from the public internet.
#
# Subsequent renewals are handled by the long-running certbot service
# in docker-compose.yml (12h sleep loop). This script is the bootstrap
# that issues the first cert; nginx can't start without a cert file at
# the configured path, and certbot can't issue a cert without nginx
# answering the ACME HTTP challenge on port 80. The "chicken and egg"
# is broken by:
#   1. writing a temporary self-signed cert at the configured path
#   2. starting nginx (it serves the temp cert + ACME challenge on :80)
#   3. running certbot with --webroot to swap the temp cert for a real one
#   4. reloading nginx to pick up the new cert
#
# Requires the proxy compose profile to be available
# (docker compose --profile proxy ...). Adapted from the canonical
# pattern by Philipp Heuer (https://medium.com/@pentacent/).

set -euo pipefail

# ── Config ────────────────────────────────────────────────────────────────
DOMAIN="${MYPROPERTY_DOMAIN:?MYPROPERTY_DOMAIN must be set, e.g. example.com}"
EMAIL="${LETSENCRYPT_EMAIL:?LETSENCRYPT_EMAIL must be set, e.g. admin@example.com}"

# Set STAGING=1 to use Let's Encrypt's staging API. Staging certs are
# untrusted by browsers but have much higher rate limits — use during
# debugging to avoid hitting the production rate limit (5 failures per
# hostname per hour).
STAGING="${STAGING:-0}"

PRIMARY="app.${DOMAIN}"
SUBDOMAINS=("app.${DOMAIN}" "api.${DOMAIN}" "auth.${DOMAIN}" "status.${DOMAIN}")
RSA_KEY_SIZE=4096
CERT_DIR="/etc/letsencrypt/live/${PRIMARY}"

# ── Compose plumbing ──────────────────────────────────────────────────────
COMPOSE="docker compose --profile proxy"

# ── Sanity checks ─────────────────────────────────────────────────────────
echo "==> Pre-flight"
echo "    Domain:     ${DOMAIN}"
echo "    Email:      ${EMAIL}"
echo "    Cert names: ${SUBDOMAINS[*]}"
echo "    Staging:    ${STAGING}"
echo

if ! command -v docker > /dev/null; then
  echo "ERROR: docker is not installed or not on PATH." >&2
  exit 1
fi

# Confirm the cert dir is in fact empty (or just contains a leftover from
# a prior failed attempt — both are safe to overwrite). Refuse to overwrite
# a real Let's Encrypt cert without an explicit FORCE=1.
if ${COMPOSE} run --rm --entrypoint sh certbot -c "[ -f ${CERT_DIR}/fullchain.pem ]" 2>/dev/null; then
  is_real=$(${COMPOSE} run --rm --entrypoint sh certbot -c "openssl x509 -in ${CERT_DIR}/fullchain.pem -noout -issuer 2>/dev/null | grep -c 'Let.s Encrypt' || true")
  if [ "${is_real}" -gt 0 ] && [ "${FORCE:-0}" != "1" ]; then
    echo "ERROR: A Let's Encrypt cert is already installed at ${CERT_DIR}/." >&2
    echo "       Renewal is handled by the certbot service automatically." >&2
    echo "       Set FORCE=1 to overwrite (rarely needed)." >&2
    exit 1
  fi
fi

# ── Step 1: write a temporary self-signed cert ───────────────────────────
# nginx refuses to start without the cert files referenced by ssl_certificate
# existing on disk. We park a 1-day dummy cert at the real path so nginx
# can start; certbot will then swap it for the real one in step 3.
echo "==> Step 1/4: writing temporary self-signed cert at ${CERT_DIR}/"
${COMPOSE} run --rm --entrypoint sh certbot -c "
  mkdir -p ${CERT_DIR}
  openssl req -x509 -nodes -newkey rsa:1024 -days 1 \
    -keyout '${CERT_DIR}/privkey.pem' \
    -out    '${CERT_DIR}/fullchain.pem' \
    -subj   '/CN=localhost'
"

# ── Step 2: start nginx ───────────────────────────────────────────────────
echo "==> Step 2/4: starting nginx with the temporary cert"
${COMPOSE} up -d --force-recreate --no-deps nginx
# Give nginx a moment to bind :80 before we ask Let's Encrypt to call back.
sleep 5

# ── Step 3: request the real cert ─────────────────────────────────────────
echo "==> Step 3/4: removing temporary cert and requesting real cert from Let's Encrypt"
${COMPOSE} run --rm --entrypoint sh certbot -c "rm -rf /etc/letsencrypt/live/${PRIMARY} /etc/letsencrypt/archive/${PRIMARY} /etc/letsencrypt/renewal/${PRIMARY}.conf"

domain_args=""
for sd in "${SUBDOMAINS[@]}"; do
  domain_args="${domain_args} -d ${sd}"
done

staging_arg=""
if [ "${STAGING}" != "0" ]; then
  staging_arg="--staging"
fi

# shellcheck disable=SC2086
${COMPOSE} run --rm --entrypoint certbot certbot \
  certonly --webroot --webroot-path=/var/www/certbot \
    ${staging_arg} \
    --email "${EMAIL}" \
    ${domain_args} \
    --rsa-key-size "${RSA_KEY_SIZE}" \
    --agree-tos \
    --no-eff-email \
    --non-interactive \
    --force-renewal

# ── Step 4: reload nginx ──────────────────────────────────────────────────
echo "==> Step 4/4: reloading nginx so it picks up the real cert"
${COMPOSE} exec nginx nginx -s reload

echo
echo "==> Done. Cert installed:"
${COMPOSE} run --rm --entrypoint sh certbot -c "openssl x509 -in ${CERT_DIR}/fullchain.pem -noout -issuer -subject -dates"
echo
echo "    Subsequent renewals are automatic (certbot service runs 'certbot renew'"
echo "    every 12h; nginx reloads its config every 6h to pick up renewed certs)."
