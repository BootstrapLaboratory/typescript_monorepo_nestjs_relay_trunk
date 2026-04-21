#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/../.." && pwd)"

if [[ -z "${DATABASE_URL_DIRECT:-}" ]]; then
  echo "DATABASE_URL_DIRECT is required" >&2
  exit 1
fi

cd "${REPO_ROOT}/common/deploy/server/apps/server"
npm run migration:run:dist
