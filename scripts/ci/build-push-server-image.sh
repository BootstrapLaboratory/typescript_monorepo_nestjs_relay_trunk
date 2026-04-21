#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/../.." && pwd)"

if [[ -z "${IMAGE_NAME:-}" ]]; then
  echo "IMAGE_NAME is required" >&2
  exit 1
fi

cd "${REPO_ROOT}"

docker build --pull -f apps/server/Dockerfile -t "${IMAGE_NAME}" .
docker push "${IMAGE_NAME}"

if [[ -n "${GITHUB_ENV:-}" ]]; then
  printf 'IMAGE_NAME=%s\n' "${IMAGE_NAME}" >> "${GITHUB_ENV}"
else
  printf 'IMAGE_NAME=%s\n' "${IMAGE_NAME}"
fi
