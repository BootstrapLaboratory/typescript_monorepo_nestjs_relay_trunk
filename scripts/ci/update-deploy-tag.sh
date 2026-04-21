#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/../.." && pwd)"

if [[ -z "${TAG_NAME:-}" ]]; then
  echo "TAG_NAME is required" >&2
  exit 1
fi

if [[ -z "${GIT_SHA:-}" ]]; then
  echo "GIT_SHA is required" >&2
  exit 1
fi

cd "${REPO_ROOT}"

git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
git tag -f "${TAG_NAME}" "${GIT_SHA}"
git push origin "refs/tags/${TAG_NAME}" --force
