#!/usr/bin/env bash
set -euo pipefail

SCRIPT_PATH="$(readlink -f -- "${BASH_SOURCE[0]}")"
SCRIPT_DIR="$(cd -- "$(dirname -- "${SCRIPT_PATH}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/../../.." && pwd)"

require_env() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "Missing required environment variable: ${name}" >&2
    exit 1
  fi
}

validate_prefix() {
  local name="$1"
  local expected_prefix="$2"
  local value="${!name}"

  if [[ "${value}" != "${expected_prefix}"* ]]; then
    echo "${name} must start with ${expected_prefix}" >&2
    exit 1
  fi
}

require_env VITE_GRAPHQL_HTTP
require_env VITE_GRAPHQL_WS

if [[ "${VITE_GRAPHQL_HTTP}" == "https://api.example.com/graphql" ]]; then
  echo "VITE_GRAPHQL_HTTP still uses the placeholder api.example.com URL." >&2
  exit 1
fi

if [[ "${VITE_GRAPHQL_WS}" == "wss://api.example.com/graphql" ]]; then
  echo "VITE_GRAPHQL_WS still uses the placeholder api.example.com URL." >&2
  exit 1
fi

validate_prefix VITE_GRAPHQL_HTTP "https://"
validate_prefix VITE_GRAPHQL_WS "wss://"

cd "${REPO_ROOT}"

node common/scripts/install-run-rush.js install --max-install-attempts 1
node common/scripts/install-run-rush.js build --to webapp
