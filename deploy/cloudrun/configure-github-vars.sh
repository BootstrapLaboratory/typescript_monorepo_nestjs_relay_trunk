#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/load-env.sh"

require_env() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "Missing required environment variable: ${name}" >&2
    exit 1
  fi
}

if ! command -v gh >/dev/null 2>&1; then
  echo "GitHub CLI (gh) is required for this helper." >&2
  exit 1
fi

require_env GITHUB_REPOSITORY
require_env PROJECT_ID
require_env ARTIFACT_REGISTRY_REPOSITORY
require_env CLOUD_RUN_SERVICE
require_env CLOUD_RUN_CORS_ORIGIN

PROJECT_NUMBER="$(gcloud projects describe "${PROJECT_ID}" --format='value(projectNumber)')"
GCP_WORKLOAD_IDENTITY_PROVIDER="${GCP_WORKLOAD_IDENTITY_PROVIDER:-$(gcloud iam workload-identity-pools providers describe "${WIF_PROVIDER_ID:-github}" \
  --project="${PROJECT_ID}" \
  --location="global" \
  --workload-identity-pool="${WIF_POOL_ID:-github-actions}" \
  --format='value(name)')}"
GCP_SERVICE_ACCOUNT="${GCP_SERVICE_ACCOUNT:-${DEPLOYER_SERVICE_ACCOUNT_ID:-github-actions-deployer}@${PROJECT_ID}.iam.gserviceaccount.com}"
CLOUD_RUN_RUNTIME_SERVICE_ACCOUNT="${CLOUD_RUN_RUNTIME_SERVICE_ACCOUNT:-${RUNTIME_SERVICE_ACCOUNT_ID:-cloud-run-runtime}@${PROJECT_ID}.iam.gserviceaccount.com}"

gh variable set GCP_PROJECT_ID --repo "${GITHUB_REPOSITORY}" --body "${PROJECT_ID}"
gh variable set GCP_WORKLOAD_IDENTITY_PROVIDER --repo "${GITHUB_REPOSITORY}" --body "${GCP_WORKLOAD_IDENTITY_PROVIDER}"
gh variable set GCP_SERVICE_ACCOUNT --repo "${GITHUB_REPOSITORY}" --body "${GCP_SERVICE_ACCOUNT}"
gh variable set GCP_ARTIFACT_REGISTRY_REPOSITORY --repo "${GITHUB_REPOSITORY}" --body "${ARTIFACT_REGISTRY_REPOSITORY}"
gh variable set CLOUD_RUN_SERVICE --repo "${GITHUB_REPOSITORY}" --body "${CLOUD_RUN_SERVICE}"
gh variable set CLOUD_RUN_RUNTIME_SERVICE_ACCOUNT --repo "${GITHUB_REPOSITORY}" --body "${CLOUD_RUN_RUNTIME_SERVICE_ACCOUNT}"
gh variable set CLOUD_RUN_CORS_ORIGIN --repo "${GITHUB_REPOSITORY}" --body "${CLOUD_RUN_CORS_ORIGIN}"

cat <<EOF
GitHub repository variables updated for ${GITHUB_REPOSITORY}.

Resolved values:
  GCP_PROJECT_ID=${PROJECT_ID}
  GCP_WORKLOAD_IDENTITY_PROVIDER=${GCP_WORKLOAD_IDENTITY_PROVIDER}
  GCP_SERVICE_ACCOUNT=${GCP_SERVICE_ACCOUNT}
  GCP_ARTIFACT_REGISTRY_REPOSITORY=${ARTIFACT_REGISTRY_REPOSITORY}
  CLOUD_RUN_SERVICE=${CLOUD_RUN_SERVICE}
  CLOUD_RUN_RUNTIME_SERVICE_ACCOUNT=${CLOUD_RUN_RUNTIME_SERVICE_ACCOUNT}
  CLOUD_RUN_CORS_ORIGIN=${CLOUD_RUN_CORS_ORIGIN}
  PROJECT_NUMBER=${PROJECT_NUMBER}
EOF
