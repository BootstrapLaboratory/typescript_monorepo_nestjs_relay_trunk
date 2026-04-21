#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/../.." && pwd)"
MISSING_PREFIX="${MISSING_PREFIX:-Missing required environment variable:}"

if [[ "$#" == "0" ]]; then
  echo "Usage: require-envs.sh VAR_NAME [VAR_NAME...]" >&2
  exit 1
fi

cd "${REPO_ROOT}"

for name in "$@"; do
  if [[ -z "${!name:-}" ]]; then
    echo "${MISSING_PREFIX} ${name}" >&2
    exit 1
  fi
done
