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

escape_env_value() {
  printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g'
}

upsert_env_local() {
  local key="$1"
  local value="$2"
  local env_local_file="${CONFIG_DIR}/.env.local"
  local temp_file
  temp_file="$(mktemp)"

  if [[ -f "${env_local_file}" ]]; then
    grep -v -E "^${key}=" "${env_local_file}" >"${temp_file}" || true
  else
    cat <<'EOF' >"${temp_file}"
# Local overrides for deploy/cloudrun/config/.env
# This file is safe to keep machine-local and is loaded after config/.env.

EOF
  fi

  printf '%s="%s"\n' "${key}" "$(escape_env_value "${value}")" >>"${temp_file}"
  mv "${temp_file}" "${env_local_file}"
}

show_help() {
  cat <<'EOF'
Usage:
  bash deploy/cloudrun/scripts/create-neon-app-user.sh [--no-sync-secrets]

Behavior:
  - loads deploy/cloudrun/config/.env and deploy/cloudrun/config/.env.local
  - creates or rotates a least-privilege Neon runtime role
  - keeps DATABASE_URL_DIRECT unchanged for migrations
  - writes the runtime DATABASE_URL override into deploy/cloudrun/config/.env.local
  - optionally syncs the updated DATABASE_URL into Secret Manager

Optional env vars:
  NEON_APP_ROLE       Defaults to "cloud_run_app"
  NEON_APP_PASSWORD   Defaults to a generated random password
EOF
}

SYNC_SECRETS=1

for arg in "$@"; do
  case "${arg}" in
    --no-sync-secrets)
      SYNC_SECRETS=0
      ;;
    --help|-h)
      show_help
      exit 0
      ;;
    *)
      echo "Unknown argument: ${arg}" >&2
      show_help >&2
      exit 1
      ;;
  esac
done

require_env DATABASE_URL
require_env DATABASE_URL_DIRECT

NEON_APP_ROLE="${NEON_APP_ROLE:-cloud_run_app}"
NEON_APP_PASSWORD="${NEON_APP_PASSWORD:-$(openssl rand -base64 48 | tr -d '\n' | tr '+/' '-_' | cut -c1-40)}"

export NEON_APP_ROLE
export NEON_APP_PASSWORD

RUNTIME_DATABASE_URL="$(
  node "${SCRIPT_DIR}/create-neon-app-user.mjs"
)"

upsert_env_local "NEON_APP_ROLE" "${NEON_APP_ROLE}"
upsert_env_local "DATABASE_URL" "${RUNTIME_DATABASE_URL}"

if [[ "${SYNC_SECRETS}" == "1" ]]; then
  bash "${SCRIPT_DIR}/sync-secrets.sh"
fi

cat <<EOF
Neon app user is ready.

Runtime role:
  ${NEON_APP_ROLE}

Updated files:
  ${CONFIG_DIR}/.env.local

Secrets:
$(if [[ "${SYNC_SECRETS}" == "1" ]]; then
  printf '  DATABASE_URL synced to Secret Manager.\n'
else
  printf '  Secret Manager sync skipped.\n'
fi)

Notes:
  - DATABASE_URL now points at the pooled runtime user.
  - DATABASE_URL_DIRECT stays on the higher-privilege direct connection for migrations.
  - To roll back, remove the DATABASE_URL override from ${CONFIG_DIR}/.env.local,
    run bash deploy/cloudrun/scripts/sync-secrets.sh, and redeploy.
EOF
