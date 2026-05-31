#!/usr/bin/env bash
# Staged Helm deploy for the project-02 namespace. Reused every batch — what
# changes per batch is the enabled flags in values-gjirafa.yaml.
# Intentionally NO --wait / --atomic: partial state persists for debugging;
# verify with kubectl afterward. Extra args ("$@") are passed to helm.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$HERE/../.." && pwd)"
KCFG="${KUBECONFIG:-$REPO_ROOT/project-02.kubeconfig}"
CHART="$REPO_ROOT/helm/myproperty"
VALUES="$CHART/values-gjirafa.yaml"
NS=project-02
RELEASE=myproperty

helm upgrade --install "$RELEASE" "$CHART" \
  --kubeconfig "$KCFG" \
  --namespace "$NS" \
  --values "$VALUES" \
  "$@"

echo
echo "Applied. Current pods/pvc in $NS:"
kubectl --kubeconfig "$KCFG" -n "$NS" get pods,pvc
