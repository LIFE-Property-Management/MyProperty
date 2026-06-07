#!/usr/bin/env bash
# Smoke-checks a running Keycloak (compose service "keycloak") against the
# rendered production realm export. A clean realm import is necessary but NOT
# sufficient — several misconfigurations import without error yet leave the
# backend's service account unable to provision users. This verifies the two
# things the import alone cannot guarantee:
#
#   1. the myproperty-api service account can obtain a client_credentials token
#      (secret rendered correctly by envsubst, service accounts enabled), and
#   2. that token carries the realm-management roles the Admin API needs
#      (client scope mapping present AND the ${client_id} placeholder survived
#      envsubst so resource_access.<client>.roles has the right shape).
#
# Exits non-zero with a clear message on any failure. Run by CI; also runnable
# locally after `docker compose up -d keycloak --wait`.
set -euo pipefail

BASE_URL="${KEYCLOAK_BASE_URL:-http://localhost:8080}"
CLIENT_SECRET="${MYPROPERTY_API_CLIENT_SECRET:-dev-api-client-secret}"

resp=$(curl -s -X POST \
  "$BASE_URL/realms/MyProperty/protocol/openid-connect/token" \
  -d grant_type=client_credentials \
  -d client_id=myproperty-api \
  -d "client_secret=$CLIENT_SECRET")

RESP="$resp" python3 - <<'PY'
import os, sys, json, base64

d = json.loads(os.environ["RESP"])
if "access_token" not in d:
    sys.exit(f"FAIL: client_credentials token request rejected: {d}")

payload = d["access_token"].split(".")[1]
payload += "=" * (-len(payload) % 4)
claims = json.loads(base64.urlsafe_b64decode(payload))

roles = set(
    claims.get("resource_access", {}).get("realm-management", {}).get("roles", [])
)
required = {"manage-users", "view-users", "view-realm"}
missing = required - roles
if missing:
    sys.exit(
        f"FAIL: service account missing realm-management roles {sorted(missing)} "
        f"(got {sorted(roles)}). Likely a missing client scope mapping, or "
        f"envsubst clobbering ${{client_id}} in the realm template."
    )

print(f"OK: realm-management roles present: {sorted(roles)}")
PY
