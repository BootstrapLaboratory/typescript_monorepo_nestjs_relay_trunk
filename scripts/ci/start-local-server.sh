#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/../.." && pwd)"
SERVER_SMOKE_LOG="${SERVER_SMOKE_LOG:-/tmp/server-smoke.log}"
SERVER_PID_FILE="${SERVER_PID_FILE:-/tmp/server-smoke.pid}"

require_env() {
  local name="$1"

  if [[ -z "${!name:-}" ]]; then
    echo "Missing required environment variable: ${name}" >&2
    exit 1
  fi
}

for name in \
  DATABASE_HOST \
  DATABASE_PORT \
  DATABASE_NAME \
  DATABASE_USER \
  DATABASE_PASSWORD
do
  require_env "${name}"
done

export DATABASE_URL="postgres://${DATABASE_USER}:${DATABASE_PASSWORD}@${DATABASE_HOST}:${DATABASE_PORT}/${DATABASE_NAME}"

cd "${REPO_ROOT}/apps/server"

rm -f "${SERVER_PID_FILE}"

node dist/main.js > "${SERVER_SMOKE_LOG}" 2>&1 &
server_pid="$!"

printf '%s\n' "${server_pid}" > "${SERVER_PID_FILE}"

if [[ -n "${GITHUB_ENV:-}" ]]; then
  printf 'SERVER_PID=%s\n' "${server_pid}" >> "${GITHUB_ENV}"
fi
