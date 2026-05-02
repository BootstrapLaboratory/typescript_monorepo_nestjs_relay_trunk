#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/lib/paths.sh"

if [[ -z "${WEBAPP_URL:-}" ]]; then
  echo "WEBAPP_URL is required" >&2
  exit 1
fi

validate_route() {
  local url="$1"

  if command -v curl > /dev/null 2>&1; then
    curl --fail --silent --show-error --location --output /dev/null "${url}"
    return
  fi

  if command -v node > /dev/null 2>&1; then
    WEBAPP_VALIDATE_URL="${url}" node --input-type=module -e '
const response = await fetch(process.env.WEBAPP_VALIDATE_URL, { redirect: "follow" })

if (!response.ok) {
  console.error(`HTTP ${response.status} for ${process.env.WEBAPP_VALIDATE_URL}`)
  process.exit(1)
}
' > /dev/null
    return
  fi

  echo "Neither curl nor node is available to validate ${url}" >&2
  return 1
}

cd "${REPO_ROOT}"

for route in / /info /docs/ /docs/tutorial/; do
  for attempt in {1..12}; do
    if validate_route "${WEBAPP_URL}${route}"; then
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
