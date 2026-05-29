#!/usr/bin/env bash
# Batch 1 — create the six application Secrets in namespace project-02.
# Idempotent. Run after copying secrets.env.example -> .secrets.env and filling it in.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$HERE/../.." && pwd)"
ENV_FILE="$HERE/.secrets.env"
KCFG="${KUBECONFIG:-$REPO_ROOT/project-02.kubeconfig}"
NS=project-02

kc() { kubectl --kubeconfig "$KCFG" -n "$NS" "$@"; }

# 1. Load operator-supplied values.
if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: $ENV_FILE missing. Copy secrets.env.example to .secrets.env and fill it in." >&2
  exit 1
fi
# shellcheck disable=SC1090
source "$ENV_FILE"

# 2. Defaults for non-secret identifiers.
POSTGRES_USER="${POSTGRES_USER:-myproperty}"
POSTGRES_DB="${POSTGRES_DB:-myproperty}"
RABBITMQ_USER="${RABBITMQ_USER:-myproperty}"
KEYCLOAK_ADMIN_USER="${KEYCLOAK_ADMIN_USER:-admin}"

# 3. Generate passwords once; persist for stable re-runs. Hex = no special chars,
#    safe inside the ADO.NET connection string the backend/migration build.
gen() { openssl rand -hex 24; }
persist() { grep -q "^$1=" "$ENV_FILE" || printf '%s="%s"\n' "$1" "$2" >> "$ENV_FILE"; }
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-$(gen)}";        persist POSTGRES_PASSWORD "$POSTGRES_PASSWORD"
RABBITMQ_PASSWORD="${RABBITMQ_PASSWORD:-$(gen)}";        persist RABBITMQ_PASSWORD "$RABBITMQ_PASSWORD"
KEYCLOAK_ADMIN_PASSWORD="${KEYCLOAK_ADMIN_PASSWORD:-$(gen)}"; persist KEYCLOAK_ADMIN_PASSWORD "$KEYCLOAK_ADMIN_PASSWORD"
KEYCLOAK_DB_PASSWORD="${KEYCLOAK_DB_PASSWORD:-$(gen)}";  persist KEYCLOAK_DB_PASSWORD "$KEYCLOAK_DB_PASSWORD"
REDIS_PASSWORD="${REDIS_PASSWORD:-$(gen)}";              persist REDIS_PASSWORD "$REDIS_PASSWORD"

# 4. Refuse to run with unreplaced placeholders.
for v in GHCR_USERNAME GHCR_PAT GOOGLE_CLIENT_ID GOOGLE_CLIENT_SECRET ANTHROPIC_API_KEY; do
  val="${!v:-}"
  if [[ -z "$val" || "$val" == *replace* || "$val" == your-* ]]; then
    echo "ERROR: $v is unset or still a placeholder in .secrets.env." >&2
    exit 1
  fi
done

# 5. Apply all six Secrets (idempotent).
apply() { kc create "$@" --dry-run=client -o yaml | kc apply -f -; }

apply secret docker-registry ghcr-pull-secret \
  --docker-server=ghcr.io \
  --docker-username="$GHCR_USERNAME" \
  --docker-password="$GHCR_PAT"

apply secret generic myproperty-postgres \
  --from-literal=postgres-user="$POSTGRES_USER" \
  --from-literal=postgres-password="$POSTGRES_PASSWORD" \
  --from-literal=postgres-db="$POSTGRES_DB" \
  --from-literal=postgres-host=postgres \
  --from-literal=postgres-port=5432 \
  --from-literal=keycloak-db-password="$KEYCLOAK_DB_PASSWORD"

apply secret generic myproperty-rabbitmq \
  --from-literal=rabbitmq-user="$RABBITMQ_USER" \
  --from-literal=rabbitmq-password="$RABBITMQ_PASSWORD"

apply secret generic myproperty-keycloak-admin \
  --from-literal=admin-user="$KEYCLOAK_ADMIN_USER" \
  --from-literal=admin-password="$KEYCLOAK_ADMIN_PASSWORD"

apply secret generic myproperty-google-oauth \
  --from-literal=client-id="$GOOGLE_CLIENT_ID" \
  --from-literal=client-secret="$GOOGLE_CLIENT_SECRET"

apply secret generic myproperty-anthropic \
  --from-literal=api-key="$ANTHROPIC_API_KEY"

apply secret generic myproperty-redis \
  --from-literal=redis-password="$REDIS_PASSWORD"

echo "✓ Secrets applied in namespace $NS:"
kc get secrets
