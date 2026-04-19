#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/lib/paths.sh"
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/load-env.sh"

require_env() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "Missing required environment variable: ${name}" >&2
    exit 1
  fi
}

upsert_secret() {
  local name="$1"
  local value="$2"

  if gcloud secrets describe "${name}" --project="${PROJECT_ID}" >/dev/null 2>&1; then
    printf '%s' "${value}" | gcloud secrets versions add "${name}" \
      --project="${PROJECT_ID}" \
      --data-file=-
  else
    printf '%s' "${value}" | gcloud secrets create "${name}" \
      --project="${PROJECT_ID}" \
      --replication-policy="automatic" \
      --data-file=-
  fi
}

grant_secret_accessor() {
  local secret_name="$1"
  local member="$2"

  gcloud secrets add-iam-policy-binding "${secret_name}" \
    --project="${PROJECT_ID}" \
    --member="${member}" \
    --role="roles/secretmanager.secretAccessor" >/dev/null
}

require_env PROJECT_ID
require_env DATABASE_URL
require_env DATABASE_URL_DIRECT
require_env REDIS_URL

DEPLOYER_SERVICE_ACCOUNT_EMAIL="${DEPLOYER_SERVICE_ACCOUNT_EMAIL:-${DEPLOYER_SERVICE_ACCOUNT_ID:-github-actions-deployer}@${PROJECT_ID}.iam.gserviceaccount.com}"
RUNTIME_SERVICE_ACCOUNT_EMAIL="${RUNTIME_SERVICE_ACCOUNT_EMAIL:-${RUNTIME_SERVICE_ACCOUNT_ID:-cloud-run-runtime}@${PROJECT_ID}.iam.gserviceaccount.com}"

upsert_secret "DATABASE_URL" "${DATABASE_URL}"
upsert_secret "DATABASE_URL_DIRECT" "${DATABASE_URL_DIRECT}"
upsert_secret "REDIS_URL" "${REDIS_URL}"

for secret_name in DATABASE_URL DATABASE_URL_DIRECT REDIS_URL; do
  grant_secret_accessor "${secret_name}" "serviceAccount:${DEPLOYER_SERVICE_ACCOUNT_EMAIL}"
done

for secret_name in DATABASE_URL REDIS_URL; do
  grant_secret_accessor "${secret_name}" "serviceAccount:${RUNTIME_SERVICE_ACCOUNT_EMAIL}"
done

cat <<EOF
Secret Manager sync complete.

Created or updated:
  DATABASE_URL
  DATABASE_URL_DIRECT
  REDIS_URL

Access granted to:
  deployer: ${DEPLOYER_SERVICE_ACCOUNT_EMAIL}
  runtime:  ${RUNTIME_SERVICE_ACCOUNT_EMAIL}

Next:
  1. Set GitHub repository variables.
  2. Trigger deploy-cloud-run-backend.
EOF
