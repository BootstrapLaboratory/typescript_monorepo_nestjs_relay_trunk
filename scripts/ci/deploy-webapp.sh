#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/../.." && pwd)"
ARTIFACT_PATH="${ARTIFACT_PATH:-${REPO_ROOT}/apps/webapp/dist}"
DEPLOY_TAG_PREFIX="${DEPLOY_TAG_PREFIX:-deploy/prod}"
WRANGLER_COMMAND="${WRANGLER_COMMAND:-npx --yes wrangler}"
DRY_RUN="${DRY_RUN:-0}"

MISSING_PREFIX="Missing required webapp deploy environment:" \
  bash "${SCRIPT_DIR}/require-envs.sh" \
  GIT_SHA \
  CLOUDFLARE_API_TOKEN \
  CLOUDFLARE_ACCOUNT_ID \
  CLOUDFLARE_PAGES_PROJECT_NAME \
  WEBAPP_VITE_GRAPHQL_HTTP \
  WEBAPP_VITE_GRAPHQL_WS \
  WEBAPP_URL

if [[ ! -d "${ARTIFACT_PATH}" ]]; then
  echo "ARTIFACT_PATH must point to a built webapp directory: ${ARTIFACT_PATH}" >&2
  exit 1
fi

cd "${REPO_ROOT}"

if [[ "${DRY_RUN}" == "1" ]]; then
  printf 'DRY_RUN: %s pages deploy %s --project-name=%s --branch=main\n' "${WRANGLER_COMMAND}" "${ARTIFACT_PATH}" "${CLOUDFLARE_PAGES_PROJECT_NAME}"
  printf 'DRY_RUN: validate deployed routes at %s\n' "${WEBAPP_URL}"
  printf 'DRY_RUN: update deploy tag %s/webapp -> %s\n' "${DEPLOY_TAG_PREFIX}" "${GIT_SHA}"
else
  ${WRANGLER_COMMAND} pages deploy "${ARTIFACT_PATH}" \
    --project-name="${CLOUDFLARE_PAGES_PROJECT_NAME}" \
    --branch=main

  WEBAPP_URL="${WEBAPP_URL}" bash "${SCRIPT_DIR}/validate-webapp-routes.sh"

  TARGET=webapp \
  DEPLOY_TAG_PREFIX="${DEPLOY_TAG_PREFIX}" \
  GIT_SHA="${GIT_SHA}" \
    bash "${SCRIPT_DIR}/update-deploy-tag.sh"
fi

if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  printf 'webapp_url=%s\n' "${WEBAPP_URL}" >> "${GITHUB_OUTPUT}"
else
  printf 'webapp_url=%s\n' "${WEBAPP_URL}"
fi
