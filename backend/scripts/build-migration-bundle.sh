#!/usr/bin/env bash
# Builds the MyProperty EF Core migration bundle and packages it as a
# Docker image. Used by CI (.github/workflows/backend-ci.yml) and by
# developers verifying the bundle locally.
#
# Local invocation:
#   ./backend/scripts/build-migration-bundle.sh
#   → produces myproperty-migrations:local, no push
#
# CI invocation:
#   PUSH=true \
#   IMAGE_REGISTRY=ghcr.io/<owner> \
#   GIT_SHA=abc1234 \
#   BRANCH_NAME=develop \
#     ./backend/scripts/build-migration-bundle.sh

set -euo pipefail

# ── Inputs ────────────────────────────────────────────────────
PUSH="${PUSH:-false}"
IMAGE_REGISTRY="${IMAGE_REGISTRY:-}"
GIT_SHA="${GIT_SHA:-}"
BRANCH_NAME="${BRANCH_NAME:-}"

# ── Paths ─────────────────────────────────────────────────────
# Script lives at backend/scripts/. Repo root is two levels up.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
BACKEND_DIR="${REPO_ROOT}/backend"

# ── Step 1: produce the bundle binary ─────────────────────────
# Output goes into a build artifacts dir that the Dockerfile expects.
BUNDLE_DIR="${BACKEND_DIR}/artifacts/migration-bundle"
rm -rf "${BUNDLE_DIR}"
mkdir -p "${BUNDLE_DIR}"

echo "▸ Producing EF migration bundle (linux-x64, framework-dependent)"
pushd "${BACKEND_DIR}" >/dev/null
dotnet ef migrations bundle \
  --project MyProperty.Infrastructure \
  --startup-project MyProperty.Api \
  --output "${BUNDLE_DIR}/efbundle" \
  --target-runtime linux-x64 \
  --force \
  --verbose
popd >/dev/null

# ── Step 2: build the Docker image ────────────────────────────
# Determine tags. In local mode there's one tag; in CI mode there
# are two.
LOCAL_TAG="myproperty-migrations:local"
TAGS=()

if [[ "${PUSH}" == "true" ]]; then
  if [[ -z "${IMAGE_REGISTRY}" || -z "${GIT_SHA}" || -z "${BRANCH_NAME}" ]]; then
    echo "ERROR: PUSH=true requires IMAGE_REGISTRY, GIT_SHA, BRANCH_NAME" >&2
    exit 1
  fi
  TAGS+=("${IMAGE_REGISTRY}/myproperty-migrations:${GIT_SHA}")
  TAGS+=("${IMAGE_REGISTRY}/myproperty-migrations:${BRANCH_NAME}")
else
  TAGS+=("${LOCAL_TAG}")
fi

echo "▸ Building Docker image"
DOCKER_BUILD_ARGS=()
for tag in "${TAGS[@]}"; do
  DOCKER_BUILD_ARGS+=(-t "${tag}")
done

docker build \
  -f "${BACKEND_DIR}/Dockerfile.migrations" \
  "${DOCKER_BUILD_ARGS[@]}" \
  "${BACKEND_DIR}"

# ── Step 3: optionally push ───────────────────────────────────
if [[ "${PUSH}" == "true" ]]; then
  for tag in "${TAGS[@]}"; do
    echo "▸ Pushing ${tag}"
    docker push "${tag}"
  done
fi

echo "✓ Done. Tags built:"
for tag in "${TAGS[@]}"; do
  echo "    ${tag}"
done
