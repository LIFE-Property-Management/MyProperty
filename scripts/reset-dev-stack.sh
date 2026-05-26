#!/usr/bin/env bash
# =============================================================
#  scripts/reset-dev-stack.sh
#
#  Atomic teardown of the local dev stack. Use when you want a
#  clean slate: empty database, empty file storage, fresh
#  Keycloak realm import.
#
#  Wipes BOTH backend_storage AND postgres_data volumes together
#  so the DB and file system can't drift out of sync (a partial
#  wipe would leave Payments(ReceiptFileKey=...) rows pointing
#  at files that no longer exist).
#
#  Usage:
#    ./scripts/reset-dev-stack.sh
#
#  Default `docker compose up` does NOT trigger this — receipts
#  and DB rows persist across normal restarts. Run this script
#  only when you want to start from zero.
# =============================================================

set -euo pipefail

# Resolve repo root regardless of where the script is invoked from.
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

echo "==> Tearing down stack (containers + ALL volumes)..."
docker compose down -v

echo "==> Removing any orphaned named volumes (defensive)..."
# `down -v` removes volumes defined in compose, but a stale
# myproperty_keycloak_import volume can survive if the keycloak-realm-init
# service was removed in a prior branch. Defensive cleanup.
for vol in myproperty_backend_storage myproperty_postgres_data myproperty_keycloak_import; do
  docker volume rm "$vol" 2>/dev/null && echo "    removed $vol" || true
done

echo "==> Stack reset complete. Run 'docker compose up -d' for a fresh start."
