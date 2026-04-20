#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/lib/paths.sh"
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/load-env.sh"

require_env() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "Missing required environment variable: ${name}" >&2
    exit 1
  fi
}

ensure_command() {
  local name="$1"
  if ! command -v "${name}" >/dev/null 2>&1; then
    echo "${name} is required for this helper." >&2
    exit 1
  fi
}

resolve_cloud_run_service_url() {
  if [[ -n "${CLOUD_RUN_PUBLIC_URL:-}" ]]; then
    printf '%s\n' "${CLOUD_RUN_PUBLIC_URL%/}"
    return
  fi

  ensure_command gcloud
  require_env PROJECT_ID
  require_env CLOUD_RUN_SERVICE

  local region="${CLOUD_RUN_REGION:-europe-west4}"

  gcloud run services describe "${CLOUD_RUN_SERVICE}" \
    --project "${PROJECT_ID}" \
    --region "${region}" \
    --format='value(status.url)'
}

resolve_webapp_graphql_http() {
  if [[ -n "${WEBAPP_VITE_GRAPHQL_HTTP:-}" ]]; then
    printf '%s\n' "${WEBAPP_VITE_GRAPHQL_HTTP}"
    return
  fi

  local service_url
  service_url="$(resolve_cloud_run_service_url)"
  printf '%s/graphql\n' "${service_url%/}"
}

resolve_webapp_graphql_ws() {
  if [[ -n "${WEBAPP_VITE_GRAPHQL_WS:-}" ]]; then
    printf '%s\n' "${WEBAPP_VITE_GRAPHQL_WS}"
    return
  fi

  local http_url
  http_url="$(resolve_webapp_graphql_http)"

  if [[ "${http_url}" == https://* ]]; then
    printf 'wss://%s\n' "${http_url#https://}"
    return
  fi

  if [[ "${http_url}" == http://* ]]; then
    printf 'ws://%s\n' "${http_url#http://}"
    return
  fi

  echo "Unable to derive WEBAPP_VITE_GRAPHQL_WS from ${http_url}" >&2
  exit 1
}

ensure_command gh

require_env GITHUB_REPOSITORY
require_env CLOUDFLARE_ACCOUNT_ID
require_env CLOUDFLARE_API_TOKEN
require_env CLOUDFLARE_PAGES_PROJECT_NAME

WEBAPP_GRAPHQL_HTTP="$(resolve_webapp_graphql_http)"
WEBAPP_GRAPHQL_WS="$(resolve_webapp_graphql_ws)"

gh secret set CLOUDFLARE_API_TOKEN --repo "${GITHUB_REPOSITORY}" --body "${CLOUDFLARE_API_TOKEN}"
gh secret set CLOUDFLARE_ACCOUNT_ID --repo "${GITHUB_REPOSITORY}" --body "${CLOUDFLARE_ACCOUNT_ID}"

gh variable set CLOUDFLARE_PAGES_PROJECT_NAME --repo "${GITHUB_REPOSITORY}" --body "${CLOUDFLARE_PAGES_PROJECT_NAME}"
gh variable set WEBAPP_VITE_GRAPHQL_HTTP --repo "${GITHUB_REPOSITORY}" --body "${WEBAPP_GRAPHQL_HTTP}"
gh variable set WEBAPP_VITE_GRAPHQL_WS --repo "${GITHUB_REPOSITORY}" --body "${WEBAPP_GRAPHQL_WS}"

cat <<EOF
GitHub repository Cloudflare Pages configuration updated for ${GITHUB_REPOSITORY}.

Resolved values:
  CLOUDFLARE_PAGES_PROJECT_NAME=${CLOUDFLARE_PAGES_PROJECT_NAME}
  WEBAPP_VITE_GRAPHQL_HTTP=${WEBAPP_GRAPHQL_HTTP}
  WEBAPP_VITE_GRAPHQL_WS=${WEBAPP_GRAPHQL_WS}
  Secrets updated:
    CLOUDFLARE_API_TOKEN
    CLOUDFLARE_ACCOUNT_ID
EOF
