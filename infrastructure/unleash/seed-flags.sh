#!/bin/sh
# Seeds the M5.6 feature flag into Unleash via the Admin API. Idempotent and
# fully tolerant: any individual call failing (e.g. the flag already exists on a
# re-run) never aborts the stack — worst case the operator creates it in the UI.
# Same one-shot init pattern as keycloak-realm-init / uptime-kuma-init.
set -u

BASE="${UNLEASH_BASE_URL:-http://unleash:4242}"
TOKEN="${UNLEASH_ADMIN_TOKEN:-*:*.unleash-insecure-admin-token}"
FLAG="payments.ocr-autoextract"
PROJECT="default"
ENVIRONMENT="development"

echo "Waiting for Unleash at ${BASE} ..."
i=0
until curl -fsS -o /dev/null "${BASE}/health"; do
  i=$((i + 1))
  if [ "$i" -ge 60 ]; then
    echo "Unleash not healthy after 60 attempts; skipping seed (create the flag in the UI)."
    exit 0
  fi
  sleep 2
done
echo "Unleash is up."

AUTH="Authorization: ${TOKEN}"
CT="Content-Type: application/json"

# 1) Create the kill-switch flag. Returns 409 if it already exists — tolerated.
curl -fsS -X POST "${BASE}/api/admin/projects/${PROJECT}/features" \
  -H "${AUTH}" -H "${CT}" \
  -d "{\"name\":\"${FLAG}\",\"type\":\"kill-switch\",\"description\":\"M5.6: OFF skips receipt OCR auto-extraction; tenants use manual entry.\"}" \
  && echo "Created ${FLAG}." \
  || echo "Create returned non-zero (flag likely already exists) — continuing."

# 2) Ensure a default (always-on) strategy exists in the dev environment.
curl -fsS -X POST "${BASE}/api/admin/projects/${PROJECT}/features/${FLAG}/environments/${ENVIRONMENT}/strategies" \
  -H "${AUTH}" -H "${CT}" \
  -d "{\"name\":\"default\"}" \
  && echo "Added default strategy in ${ENVIRONMENT}." \
  || echo "Strategy add returned non-zero (likely already present) — continuing."

# 3) Enable the flag in the dev environment.
curl -fsS -X POST "${BASE}/api/admin/projects/${PROJECT}/features/${FLAG}/environments/${ENVIRONMENT}/on" \
  -H "${AUTH}" \
  && echo "Enabled ${FLAG} in ${ENVIRONMENT}." \
  || echo "Enable returned non-zero — continuing."

echo "Unleash flag seeding done."
