#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/lib/paths.sh"

ARTIFACT_PATH="${ARTIFACT_PATH:-${REPO_ROOT}/common/deploy/server}"
IMAGE_NAME="${IMAGE_NAME:-}"
DRY_RUN="${DRY_RUN:-0}"

require_env() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "Missing required server deploy environment: ${name}" >&2
    exit 1
  fi
}

for name in \
  GIT_SHA \
  GCP_PROJECT_ID \
  GCP_ARTIFACT_REGISTRY_REPOSITORY \
  CLOUD_RUN_SERVICE \
  CLOUD_RUN_RUNTIME_SERVICE_ACCOUNT \
  CLOUD_RUN_CORS_ORIGIN \
  CLOUD_RUN_REGION
do
  require_env "${name}"
done

if [[ ! -d "${ARTIFACT_PATH}/apps/server" ]]; then
  echo "ARTIFACT_PATH must point to an extracted backend deploy bundle: ${ARTIFACT_PATH}" >&2
  exit 1
fi

if [[ -z "${IMAGE_NAME}" ]]; then
  IMAGE_NAME="${CLOUD_RUN_REGION}-docker.pkg.dev/${GCP_PROJECT_ID}/${GCP_ARTIFACT_REGISTRY_REPOSITORY}/${CLOUD_RUN_SERVICE}:${GIT_SHA}"
fi

cd "${REPO_ROOT}"

service_url=""

if [[ "${DRY_RUN}" == "1" ]]; then
  for secret_name in DATABASE_URL DATABASE_URL_DIRECT REDIS_URL; do
    printf 'DRY_RUN: gcloud secrets versions access latest --secret %s --project %s\n' "${secret_name}" "${GCP_PROJECT_ID}"
  done

  printf 'DRY_RUN: run migrations from %s/apps/server\n' "${ARTIFACT_PATH}"
  printf 'DRY_RUN: gcloud auth configure-docker %s-docker.pkg.dev --quiet\n' "${CLOUD_RUN_REGION}"
  printf 'DRY_RUN: docker build --pull -f apps/server/Dockerfile -t %s .\n' "${IMAGE_NAME}"
  printf 'DRY_RUN: docker push %s\n' "${IMAGE_NAME}"
  printf 'DRY_RUN: gcloud run deploy %s --region %s --project %s --image %s ...\n' "${CLOUD_RUN_SERVICE}" "${CLOUD_RUN_REGION}" "${GCP_PROJECT_ID}" "${IMAGE_NAME}"
  printf 'DRY_RUN: run smoke tests against deployed service URL\n'
  service_url="https://dry-run.invalid/${CLOUD_RUN_SERVICE}"
else
  for secret_name in DATABASE_URL DATABASE_URL_DIRECT REDIS_URL; do
    gcloud secrets versions access latest \
      --secret "${secret_name}" \
      --project "${GCP_PROJECT_ID}" \
      > /dev/null
  done

  database_url_direct="$(
    gcloud secrets versions access latest \
      --secret "DATABASE_URL_DIRECT" \
      --project "${GCP_PROJECT_ID}" \
      | tr -d '\r\n'
  )"

  (
    cd "${ARTIFACT_PATH}/apps/server"
    NODE_ENV=production \
    DATABASE_URL_DIRECT="${database_url_direct}" \
    DATABASE_SYNCHRONIZE=false \
    DATABASE_SSL=true \
    DATABASE_SSL_REJECT_UNAUTHORIZED=false \
    npm run migration:run:dist
  )

  gcloud auth configure-docker "${CLOUD_RUN_REGION}-docker.pkg.dev" --quiet

  docker build --pull -f apps/server/Dockerfile -t "${IMAGE_NAME}" .
  docker push "${IMAGE_NAME}"

  gcloud run deploy "${CLOUD_RUN_SERVICE}" \
    --region "${CLOUD_RUN_REGION}" \
    --project "${GCP_PROJECT_ID}" \
    --image "${IMAGE_NAME}" \
    --set-env-vars "NODE_ENV=production,HOST=0.0.0.0,GRAPHQL_PATH=/graphql,PUBSUB_DRIVER=redis,DATABASE_SYNCHRONIZE=false,DATABASE_SSL=true,DATABASE_SSL_REJECT_UNAUTHORIZED=false,CORS_ORIGIN=${CLOUD_RUN_CORS_ORIGIN},LOG_VERBOSE_PUBSUB=false,LOG_GRAPHQL_SUBSCRIPTIONS=false" \
    --set-secrets "DATABASE_URL=DATABASE_URL:latest,REDIS_URL=REDIS_URL:latest" \
    --port 3000 \
    --service-account "${CLOUD_RUN_RUNTIME_SERVICE_ACCOUNT}" \
    --no-invoker-iam-check \
    --min-instances 0 \
    --max-instances 3 \
    --concurrency 20 \
    --timeout 3600

  service_url="$(
    gcloud run services describe "${CLOUD_RUN_SERVICE}" \
      --region "${CLOUD_RUN_REGION}" \
      --project "${GCP_PROJECT_ID}" \
      --format='value(status.url)'
  )"

  SERVICE_URL="${service_url}" bash "${REPO_ROOT}/deploy/cloudrun/tests/validate-post-deploy-smoke.sh"
fi

if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  printf 'service_url=%s\n' "${service_url}" >> "${GITHUB_OUTPUT}"
  printf 'image_name=%s\n' "${IMAGE_NAME}" >> "${GITHUB_OUTPUT}"
else
  printf 'service_url=%s\n' "${service_url}"
  printf 'image_name=%s\n' "${IMAGE_NAME}"
fi
