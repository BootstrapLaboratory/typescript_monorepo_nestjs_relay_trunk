#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/../.." && pwd)"

if [[ -z "${WEBAPP_URL:-}" ]]; then
  echo "WEBAPP_URL is required" >&2
  exit 1
fi

cd "${REPO_ROOT}"

for route in / /info; do
  for attempt in {1..12}; do
    if curl --fail --silent --show-error --location --output /dev/null "${WEBAPP_URL}${route}" > /dev/null; then
      echo "Validated ${WEBAPP_URL}${route}"
      break
    fi

    if [[ "${attempt}" == "12" ]]; then
      echo "Failed to validate ${WEBAPP_URL}${route}" >&2
      exit 1
    fi

    sleep 10
  done
done
