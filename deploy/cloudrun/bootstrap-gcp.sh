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

create_project_if_missing() {
  if gcloud projects describe "${PROJECT_ID}" >/dev/null 2>&1; then
    return
  fi

  gcloud projects create "${PROJECT_ID}" --name="${PROJECT_NAME}"
}

create_service_account_if_missing() {
  local account_id="$1"
  local display_name="$2"

  if gcloud iam service-accounts describe \
    "${account_id}@${PROJECT_ID}.iam.gserviceaccount.com" \
    --project="${PROJECT_ID}" >/dev/null 2>&1; then
    return
  fi

  gcloud iam service-accounts create "${account_id}" \
    --project="${PROJECT_ID}" \
    --display-name="${display_name}"
}

PROJECT_NAME="${PROJECT_NAME:-${PROJECT_ID:-}}"
CLOUD_RUN_REGION="${CLOUD_RUN_REGION:-europe-west4}"
ARTIFACT_REGISTRY_REPOSITORY="${ARTIFACT_REGISTRY_REPOSITORY:-cloud-run-backend}"
CLOUD_RUN_SERVICE="${CLOUD_RUN_SERVICE:-api}"
WIF_POOL_ID="${WIF_POOL_ID:-github-actions}"
WIF_PROVIDER_ID="${WIF_PROVIDER_ID:-github}"
DEPLOYER_SERVICE_ACCOUNT_ID="${DEPLOYER_SERVICE_ACCOUNT_ID:-github-actions-deployer}"
RUNTIME_SERVICE_ACCOUNT_ID="${RUNTIME_SERVICE_ACCOUNT_ID:-cloud-run-runtime}"

require_env PROJECT_ID
require_env PROJECT_NAME
require_env GITHUB_REPOSITORY

GITHUB_OWNER="${GITHUB_OWNER:-${GITHUB_REPOSITORY%%/*}}"

create_project_if_missing

if [[ -n "${BILLING_ACCOUNT_ID:-}" ]]; then
  gcloud beta billing projects link "${PROJECT_ID}" \
    --billing-account="${BILLING_ACCOUNT_ID}" >/dev/null
fi

gcloud config set project "${PROJECT_ID}" >/dev/null

gcloud services enable \
  artifactregistry.googleapis.com \
  cloudresourcemanager.googleapis.com \
  iam.googleapis.com \
  iamcredentials.googleapis.com \
  run.googleapis.com \
  secretmanager.googleapis.com \
  serviceusage.googleapis.com \
  sts.googleapis.com

if ! gcloud artifacts repositories describe "${ARTIFACT_REGISTRY_REPOSITORY}" \
  --project="${PROJECT_ID}" \
  --location="${CLOUD_RUN_REGION}" >/dev/null 2>&1; then
  gcloud artifacts repositories create "${ARTIFACT_REGISTRY_REPOSITORY}" \
    --project="${PROJECT_ID}" \
    --location="${CLOUD_RUN_REGION}" \
    --repository-format=docker \
    --description="Cloud Run backend images"
fi

create_service_account_if_missing "${DEPLOYER_SERVICE_ACCOUNT_ID}" "GitHub Actions deployer"
create_service_account_if_missing "${RUNTIME_SERVICE_ACCOUNT_ID}" "Cloud Run runtime"

DEPLOYER_SERVICE_ACCOUNT_EMAIL="${DEPLOYER_SERVICE_ACCOUNT_ID}@${PROJECT_ID}.iam.gserviceaccount.com"
RUNTIME_SERVICE_ACCOUNT_EMAIL="${RUNTIME_SERVICE_ACCOUNT_ID}@${PROJECT_ID}.iam.gserviceaccount.com"

if ! gcloud iam workload-identity-pools describe "${WIF_POOL_ID}" \
  --project="${PROJECT_ID}" \
  --location="global" >/dev/null 2>&1; then
  gcloud iam workload-identity-pools create "${WIF_POOL_ID}" \
    --project="${PROJECT_ID}" \
    --location="global" \
    --display-name="GitHub Actions Pool"
fi

if ! gcloud iam workload-identity-pools providers describe "${WIF_PROVIDER_ID}" \
  --project="${PROJECT_ID}" \
  --location="global" \
  --workload-identity-pool="${WIF_POOL_ID}" >/dev/null 2>&1; then
  gcloud iam workload-identity-pools providers create-oidc "${WIF_PROVIDER_ID}" \
    --project="${PROJECT_ID}" \
    --location="global" \
    --workload-identity-pool="${WIF_POOL_ID}" \
    --display-name="GitHub repository provider" \
    --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository,attribute.repository_owner=assertion.repository_owner,attribute.ref=assertion.ref" \
    --attribute-condition="assertion.repository == '${GITHUB_REPOSITORY}'" \
    --issuer-uri="https://token.actions.githubusercontent.com"
fi

PROJECT_NUMBER="$(gcloud projects describe "${PROJECT_ID}" --format='value(projectNumber)')"
WORKLOAD_IDENTITY_POOL_NAME="$(gcloud iam workload-identity-pools describe "${WIF_POOL_ID}" \
  --project="${PROJECT_ID}" \
  --location="global" \
  --format='value(name)')"
WORKLOAD_IDENTITY_PROVIDER_NAME="$(gcloud iam workload-identity-pools providers describe "${WIF_PROVIDER_ID}" \
  --project="${PROJECT_ID}" \
  --location="global" \
  --workload-identity-pool="${WIF_POOL_ID}" \
  --format='value(name)')"

gcloud iam service-accounts add-iam-policy-binding "${DEPLOYER_SERVICE_ACCOUNT_EMAIL}" \
  --project="${PROJECT_ID}" \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/${WORKLOAD_IDENTITY_POOL_NAME}/attribute.repository/${GITHUB_REPOSITORY}" >/dev/null

gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${DEPLOYER_SERVICE_ACCOUNT_EMAIL}" \
  --role="roles/run.admin" >/dev/null

gcloud iam service-accounts add-iam-policy-binding "${RUNTIME_SERVICE_ACCOUNT_EMAIL}" \
  --project="${PROJECT_ID}" \
  --member="serviceAccount:${DEPLOYER_SERVICE_ACCOUNT_EMAIL}" \
  --role="roles/iam.serviceAccountUser" >/dev/null

gcloud artifacts repositories add-iam-policy-binding "${ARTIFACT_REGISTRY_REPOSITORY}" \
  --project="${PROJECT_ID}" \
  --location="${CLOUD_RUN_REGION}" \
  --member="serviceAccount:${DEPLOYER_SERVICE_ACCOUNT_EMAIL}" \
  --role="roles/artifactregistry.writer" >/dev/null

cat <<EOF
GCP bootstrap complete.

Project:
  PROJECT_ID=${PROJECT_ID}
  PROJECT_NUMBER=${PROJECT_NUMBER}
  CLOUD_RUN_REGION=${CLOUD_RUN_REGION}

Artifact Registry:
  GCP_ARTIFACT_REGISTRY_REPOSITORY=${ARTIFACT_REGISTRY_REPOSITORY}

Service accounts:
  GCP_SERVICE_ACCOUNT=${DEPLOYER_SERVICE_ACCOUNT_EMAIL}
  CLOUD_RUN_RUNTIME_SERVICE_ACCOUNT=${RUNTIME_SERVICE_ACCOUNT_EMAIL}

GitHub Actions Workload Identity:
  GCP_WORKLOAD_IDENTITY_PROVIDER=${WORKLOAD_IDENTITY_PROVIDER_NAME}

Suggested GitHub repository variables:
  GCP_PROJECT_ID=${PROJECT_ID}
  GCP_WORKLOAD_IDENTITY_PROVIDER=${WORKLOAD_IDENTITY_PROVIDER_NAME}
  GCP_SERVICE_ACCOUNT=${DEPLOYER_SERVICE_ACCOUNT_EMAIL}
  GCP_ARTIFACT_REGISTRY_REPOSITORY=${ARTIFACT_REGISTRY_REPOSITORY}
  CLOUD_RUN_SERVICE=${CLOUD_RUN_SERVICE}
  CLOUD_RUN_RUNTIME_SERVICE_ACCOUNT=${RUNTIME_SERVICE_ACCOUNT_EMAIL}

Next:
  1. Update ${SCRIPT_DIR}/.env with the real Neon and Redis values.
  2. Run deploy/cloudrun/sync-secrets.sh to create/update Secret Manager secrets.
  3. Run deploy/cloudrun/configure-github-vars.sh and deploy.
EOF
