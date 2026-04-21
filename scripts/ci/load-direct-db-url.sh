#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/../.." && pwd)"

if [[ -z "${GCP_PROJECT_ID:-}" ]]; then
  echo "GCP_PROJECT_ID is required" >&2
  exit 1
fi

cd "${REPO_ROOT}"

secret_value="$(
  gcloud secrets versions access latest \
    --secret=DATABASE_URL_DIRECT \
    --project "${GCP_PROJECT_ID}" \
    | tr -d '\r\n'
)"

if [[ -n "${GITHUB_ENV:-}" ]]; then
  printf 'DATABASE_URL_DIRECT=%s\n' "${secret_value}" >> "${GITHUB_ENV}"
else
  printf 'DATABASE_URL_DIRECT=%s\n' "${secret_value}"
fi
