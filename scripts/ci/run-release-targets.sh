#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/../.." && pwd)"
targets=()

if [[ "${DEPLOY_SERVER:-false}" == "true" ]]; then
  targets+=(--to server)
fi

if [[ "${DEPLOY_WEBAPP:-false}" == "true" ]]; then
  targets+=(--to webapp)
fi

if [[ "${#targets[@]}" == "0" ]]; then
  echo "No Rush release targets were selected." >&2
  exit 1
fi

cd "${REPO_ROOT}"

node common/scripts/install-run-rush.js lint "${targets[@]}"
node common/scripts/install-run-rush.js test "${targets[@]}"
node common/scripts/install-run-rush.js build "${targets[@]}"
