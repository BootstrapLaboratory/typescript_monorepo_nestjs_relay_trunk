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

if ! command -v curl >/dev/null 2>&1; then
  echo "curl is required for this helper." >&2
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "node is required for this helper." >&2
  exit 1
fi

require_env CLOUDFLARE_ACCOUNT_ID
require_env CLOUDFLARE_API_TOKEN
require_env CLOUDFLARE_PAGES_PROJECT_NAME

production_branch="${CLOUDFLARE_PAGES_PRODUCTION_BRANCH:-main}"
response_file="$(mktemp)"
verify_file="$(mktemp)"
trap 'rm -f "${response_file}" "${verify_file}"' EXIT

http_status="$(
  curl \
    --silent \
    --show-error \
    --write-out '%{http_code}' \
    --output "${response_file}" \
    --request PATCH \
    "https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/pages/projects/${CLOUDFLARE_PAGES_PROJECT_NAME}" \
    --header "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
    --header "Content-Type: application/json" \
    --data "$(cat <<EOF
{"production_branch":"${production_branch}","source":{"config":{"deployments_enabled":false,"production_deployments_enabled":false,"preview_deployment_setting":"none"}}}
EOF
)"
)"

if [[ ! "${http_status}" =~ ^2 ]]; then
  echo "Cloudflare API request failed with status ${http_status}." >&2
  cat "${response_file}" >&2
  exit 1
fi

verify_status="$(
  curl \
    --silent \
    --show-error \
    --write-out '%{http_code}' \
    --output "${verify_file}" \
    --request GET \
    "https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/pages/projects/${CLOUDFLARE_PAGES_PROJECT_NAME}" \
    --header "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
    --header "Content-Type: application/json"
)"

if [[ ! "${verify_status}" =~ ^2 ]]; then
  echo "Cloudflare verification request failed with status ${verify_status}." >&2
  cat "${verify_file}" >&2
  exit 1
fi

node - "${verify_file}" "${CLOUDFLARE_PAGES_PROJECT_NAME}" <<'NODE'
const fs = require("fs");

const [responseFile, projectName] = process.argv.slice(2);
const payload = JSON.parse(fs.readFileSync(responseFile, "utf8"));

if (!payload.success) {
  console.error(`Cloudflare API reported failure for project ${projectName}.`);
  console.error(JSON.stringify(payload.errors ?? payload, null, 2));
  process.exit(1);
}

const result = payload.result ?? {};
const sourceConfig = result.source?.config ?? {};

console.log(`Updated Cloudflare Pages project ${projectName}.`);
console.log(`  production_branch=${sourceConfig.production_branch ?? result.production_branch ?? "unknown"}`);
console.log(`  deployments_enabled=${String(sourceConfig.deployments_enabled)}`);
console.log(`  production_deployments_enabled=${String(sourceConfig.production_deployments_enabled)}`);
console.log(`  preview_deployment_setting=${sourceConfig.preview_deployment_setting ?? "unknown"}`);
NODE
