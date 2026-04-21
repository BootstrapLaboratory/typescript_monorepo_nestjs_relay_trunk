#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/../.." && pwd)"
FAILURE_MODE="${FAILURE_MODE:-${1:-deploy}}"

case "${FAILURE_MODE}" in
  merge)
    action_name="merging"
    ;;
  deploy)
    action_name="deploying"
    ;;
  *)
    echo "Unsupported FAILURE_MODE: ${FAILURE_MODE}" >&2
    exit 1
    ;;
esac

cd "${REPO_ROOT}"

npm --prefix apps/server run graphql:schema

if ! git diff --exit-code -- libs/api/schema.gql; then
  echo "GraphQL contract drift detected." >&2
  echo "Regenerate and commit libs/api/schema.gql before ${action_name}." >&2
  git --no-pager diff -- libs/api/schema.gql
  exit 1
fi
