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

show_help() {
  cat <<'EOF'
Usage:
  bash deploy/cloudrun/scripts/create-monitoring-email-channel.sh [--email=you@example.com] [--print-name-only]

Behavior:
  - loads deploy/cloudrun/config/.env and deploy/cloudrun/config/.env.local
  - reuses an existing Cloud Monitoring email notification channel when possible
  - otherwise creates one
  - prints verification status so you can finish any required email verification

Inputs:
  --email=... or MONITORING_EMAIL_ADDRESS

Optional env vars:
  MONITORING_CHANNEL_DISPLAY_NAME
  MONITORING_CHANNEL_DESCRIPTION
EOF
}

PRINT_NAME_ONLY=0
MONITORING_EMAIL="${MONITORING_EMAIL_ADDRESS:-}"

for arg in "$@"; do
  case "${arg}" in
    --email=*)
      MONITORING_EMAIL="${arg#*=}"
      ;;
    --print-name-only)
      PRINT_NAME_ONLY=1
      ;;
    --help|-h)
      show_help
      exit 0
      ;;
    *)
      echo "Unknown argument: ${arg}" >&2
      show_help >&2
      exit 1
      ;;
  esac
done

require_env PROJECT_ID

if [[ -z "${MONITORING_EMAIL}" ]]; then
  echo "Missing monitoring email. Set MONITORING_EMAIL_ADDRESS or pass --email=..." >&2
  exit 1
fi

CHANNEL_DISPLAY_NAME="${MONITORING_CHANNEL_DISPLAY_NAME:-${CLOUD_RUN_SERVICE:-cloud-run} monitoring email}"
CHANNEL_DESCRIPTION="${MONITORING_CHANNEL_DESCRIPTION:-Email notifications for Cloud Run monitoring incidents}"

CHANNEL_NAME="$(
  gcloud beta monitoring channels list \
    --project "${PROJECT_ID}" \
    --format=json \
  | node -e '
      const fs = require("fs");
      const channels = JSON.parse(fs.readFileSync(0, "utf8"));
      const email = process.argv[1];
      const match = channels.find((channel) => {
        return (
          channel.type === "email" &&
          channel.labels &&
          channel.labels.email_address === email
        );
      });
      process.stdout.write(match?.name ?? "");
    ' "${MONITORING_EMAIL}"
)"

if [[ -z "${CHANNEL_NAME}" ]]; then
  CHANNEL_NAME="$(
    gcloud beta monitoring channels create \
      --project "${PROJECT_ID}" \
      --display-name "${CHANNEL_DISPLAY_NAME}" \
      --description "${CHANNEL_DESCRIPTION}" \
      --type=email \
      --channel-labels "email_address=${MONITORING_EMAIL}" \
      --format='value(name)'
  )"
fi

VERIFICATION_STATUS="$(
  gcloud beta monitoring channels describe "${CHANNEL_NAME}" \
    --project "${PROJECT_ID}" \
    --format='value(verificationStatus)'
)"

if [[ "${PRINT_NAME_ONLY}" == "1" ]]; then
  printf '%s\n' "${CHANNEL_NAME}"
  exit 0
fi

cat <<EOF
Cloud Monitoring email notification channel is ready.

Project:
  ${PROJECT_ID}

Channel:
  ${CHANNEL_NAME}
  email: ${MONITORING_EMAIL}
  verificationStatus: ${VERIFICATION_STATUS:-unknown}

Note:
  If verificationStatus is not VERIFIED yet, check the inbox for ${MONITORING_EMAIL}
  and complete the Cloud Monitoring verification flow before relying on email delivery.
EOF
