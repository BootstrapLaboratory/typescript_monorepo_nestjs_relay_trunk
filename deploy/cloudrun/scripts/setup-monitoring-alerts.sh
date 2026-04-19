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
  bash deploy/cloudrun/scripts/setup-monitoring-alerts.sh

Behavior:
  - enables required Monitoring/Logging APIs
  - creates or updates a Cloud Run health uptime check
  - creates or updates log-based metrics for backend failure events
  - recreates alert policies for Cloud Run health and backend failure spikes
  - optionally attaches notification channels

Notification channel inputs:
  - MONITORING_NOTIFICATION_CHANNELS: comma-separated channel names or IDs
  - MONITORING_EMAIL_ADDRESS: optional helper path to create/reuse one email channel

If no notification channels are configured:
  - alert policies are still created
  - incidents appear in Cloud Monitoring
  - no external notifications are delivered until channels are added later
EOF
}

for arg in "$@"; do
  case "${arg}" in
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
require_env CLOUD_RUN_SERVICE
require_env CLOUD_RUN_REGION

TEMP_DIR="$(mktemp -d)"

cleanup() {
  rm -rf "${TEMP_DIR}"
}

trap cleanup EXIT

MONITORING_UPTIME_DISPLAY_NAME="${MONITORING_UPTIME_DISPLAY_NAME:-${CLOUD_RUN_SERVICE} health uptime}"
MONITORING_UPTIME_PATH="${MONITORING_UPTIME_PATH:-/health}"
MONITORING_UPTIME_PERIOD="${MONITORING_UPTIME_PERIOD:-1}"
MONITORING_UPTIME_TIMEOUT="${MONITORING_UPTIME_TIMEOUT:-10}"

UPTIME_POLICY_DISPLAY_NAME="${CLOUD_RUN_SERVICE} Cloud Run health"
BACKEND_FAILURE_POLICY_DISPLAY_NAME="${CLOUD_RUN_SERVICE} backend critical failures"

SERVICE_URL="$(
  gcloud run services describe "${CLOUD_RUN_SERVICE}" \
    --project "${PROJECT_ID}" \
    --region "${CLOUD_RUN_REGION}" \
    --format='value(status.url)'
)"

if [[ -z "${SERVICE_URL}" ]]; then
  echo "Could not determine the Cloud Run service URL for ${CLOUD_RUN_SERVICE}." >&2
  exit 1
fi

SERVICE_HOST="$(
  node -e 'process.stdout.write(new URL(process.argv[1]).host)' "${SERVICE_URL}"
)"

declare -a NOTIFICATION_CHANNELS=()

if [[ -n "${MONITORING_NOTIFICATION_CHANNELS:-}" ]]; then
  IFS=',' read -r -a raw_channels <<< "${MONITORING_NOTIFICATION_CHANNELS}"
  for raw_channel in "${raw_channels[@]}"; do
    trimmed_channel="$(printf '%s' "${raw_channel}" | xargs)"
    if [[ -z "${trimmed_channel}" ]]; then
      continue
    fi

    if [[ "${trimmed_channel}" == projects/*/notificationChannels/* ]]; then
      NOTIFICATION_CHANNELS+=("${trimmed_channel}")
    else
      NOTIFICATION_CHANNELS+=("projects/${PROJECT_ID}/notificationChannels/${trimmed_channel}")
    fi
  done
fi

if [[ -n "${MONITORING_EMAIL_ADDRESS:-}" ]]; then
  email_channel_name="$(
    bash "${SCRIPT_DIR}/create-monitoring-email-channel.sh" --print-name-only
  )"
  NOTIFICATION_CHANNELS+=("${email_channel_name}")
fi

NOTIFICATION_CHANNELS_JSON="$(
  node -e '
    const channels = [...new Set(process.argv.slice(1).filter(Boolean))];
    process.stdout.write(JSON.stringify(channels));
  ' "${NOTIFICATION_CHANNELS[@]}"
)"

ensure_service_api() {
  gcloud services enable "$@" \
    --project "${PROJECT_ID}" >/dev/null
}

find_uptime_check_name() {
  gcloud monitoring uptime list-configs \
    --project "${PROJECT_ID}" \
    --format=json \
  | node -e '
      const fs = require("fs");
      const items = JSON.parse(fs.readFileSync(0, "utf8"));
      const displayName = process.argv[1];
      const match = items.find((item) => item.displayName === displayName);
      process.stdout.write(match?.name ?? "");
    ' "${MONITORING_UPTIME_DISPLAY_NAME}"
}

ensure_log_metric() {
  local metric_name="$1"
  local description="$2"
  local filter_expression="$3"

  if gcloud logging metrics describe "${metric_name}" \
    --project "${PROJECT_ID}" >/dev/null 2>&1; then
    gcloud logging metrics update "${metric_name}" \
      --project "${PROJECT_ID}" \
      --description "${description}" \
      --log-filter "${filter_expression}" >/dev/null
    return
  fi

  gcloud logging metrics create "${metric_name}" \
    --project "${PROJECT_ID}" \
    --description "${description}" \
    --log-filter "${filter_expression}" >/dev/null
}

delete_policies_by_display_name() {
  local display_name="$1"
  mapfile -t policy_names < <(
    gcloud monitoring policies list \
      --project "${PROJECT_ID}" \
      --format=json \
    | node -e '
        const fs = require("fs");
        const policies = JSON.parse(fs.readFileSync(0, "utf8"));
        const displayName = process.argv[1];
        for (const policy of policies) {
          if (policy.displayName === displayName && policy.name) {
            console.log(policy.name);
          }
        }
      ' "${display_name}"
  )

  for policy_name in "${policy_names[@]}"; do
    gcloud monitoring policies delete "${policy_name}" \
      --project "${PROJECT_ID}" \
      --quiet >/dev/null
  done
}

ensure_service_api monitoring.googleapis.com logging.googleapis.com

UPTIME_CHECK_NAME="$(find_uptime_check_name)"

if [[ -n "${UPTIME_CHECK_NAME}" ]]; then
  gcloud monitoring uptime update "${UPTIME_CHECK_NAME}" \
    --project "${PROJECT_ID}" \
    --display-name "${MONITORING_UPTIME_DISPLAY_NAME}" \
    --path "${MONITORING_UPTIME_PATH}" \
    --period "${MONITORING_UPTIME_PERIOD}" \
    --timeout "${MONITORING_UPTIME_TIMEOUT}" \
    --set-status-classes=2xx \
    --validate-ssl=true >/dev/null
else
  UPTIME_CHECK_NAME="$(
    gcloud monitoring uptime create "${MONITORING_UPTIME_DISPLAY_NAME}" \
      --project "${PROJECT_ID}" \
      --resource-type=uptime-url \
      --resource-labels="host=${SERVICE_HOST},project_id=${PROJECT_ID}" \
      --protocol=https \
      --path "${MONITORING_UPTIME_PATH}" \
      --period "${MONITORING_UPTIME_PERIOD}" \
      --timeout "${MONITORING_UPTIME_TIMEOUT}" \
      --status-classes=2xx \
      --validate-ssl=true \
      --format='value(name)'
  )"
fi

UPTIME_CHECK_ID="${UPTIME_CHECK_NAME##*/}"

BOOTSTRAP_FAILURE_METRIC="cloudrun_backend_bootstrap_failures"
DATABASE_FAILURE_METRIC="cloudrun_backend_database_failures"
REDIS_FAILURE_METRIC="cloudrun_backend_redis_pubsub_failures"

BOOTSTRAP_FAILURE_FILTER="$(cat <<EOF
resource.type="cloud_run_revision"
resource.labels.service_name="${CLOUD_RUN_SERVICE}"
resource.labels.location="${CLOUD_RUN_REGION}"
textPayload:"app_bootstrap_failed"
EOF
)"

DATABASE_FAILURE_FILTER="$(cat <<EOF
resource.type="cloud_run_revision"
resource.labels.service_name="${CLOUD_RUN_SERVICE}"
resource.labels.location="${CLOUD_RUN_REGION}"
textPayload:"database_connect_failed"
EOF
)"

REDIS_FAILURE_FILTER="$(cat <<EOF
resource.type="cloud_run_revision"
resource.labels.service_name="${CLOUD_RUN_SERVICE}"
resource.labels.location="${CLOUD_RUN_REGION}"
(textPayload:"redis_client_error" OR textPayload:"chat_pubsub_init_failed" OR textPayload:"chat_pubsub_publish_failed" OR textPayload:"chat_pubsub_deliver_failed" OR textPayload:"chat_pubsub_deliver_parse_failed")
EOF
)"

ensure_log_metric \
  "${BOOTSTRAP_FAILURE_METRIC}" \
  "Count of Cloud Run backend bootstrap failures for ${CLOUD_RUN_SERVICE}" \
  "${BOOTSTRAP_FAILURE_FILTER}"

ensure_log_metric \
  "${DATABASE_FAILURE_METRIC}" \
  "Count of backend database connection failures for ${CLOUD_RUN_SERVICE}" \
  "${DATABASE_FAILURE_FILTER}"

ensure_log_metric \
  "${REDIS_FAILURE_METRIC}" \
  "Count of backend Redis and pub/sub failures for ${CLOUD_RUN_SERVICE}" \
  "${REDIS_FAILURE_FILTER}"

UPTIME_POLICY_FILE="${TEMP_DIR}/uptime-policy.json"
BACKEND_FAILURE_POLICY_FILE="${TEMP_DIR}/backend-failure-policy.json"

node - "${UPTIME_POLICY_FILE}" "${UPTIME_POLICY_DISPLAY_NAME}" "${UPTIME_CHECK_ID}" "${NOTIFICATION_CHANNELS_JSON}" "${CLOUD_RUN_SERVICE}" "${SERVICE_URL}" "${MONITORING_UPTIME_PATH}" <<'EOF'
const fs = require("fs");

const [
  outputFile,
  displayName,
  uptimeCheckId,
  notificationChannelsJson,
  serviceName,
  serviceUrl,
  uptimePath,
] = process.argv.slice(2);

const notificationChannels = JSON.parse(notificationChannelsJson);

const policy = {
  displayName,
  combiner: "OR",
  documentation: {
    content: [
      `Cloud Run health check is failing for \`${serviceName}\`.`,
      "",
      `Service URL: ${serviceUrl}`,
      `Uptime path: ${uptimePath}`,
      "",
      "Next steps:",
      "1. Open Cloud Monitoring incidents and confirm the failing uptime check.",
      "2. Run the log queries from `deploy/cloudrun/docs/OPERATIONS.md`.",
      "3. If the current revision is bad, use the rollback procedure in `deploy/cloudrun/docs/OPERATIONS.md`.",
    ].join("\n"),
    mimeType: "text/markdown",
  },
  enabled: true,
  userLabels: {
    module: "cloudrun",
    category: "uptime",
    service: serviceName.toLowerCase(),
  },
  conditions: [
    {
      displayName: `${serviceName} /health uptime failure`,
      conditionThreshold: {
        aggregations: [
          {
            alignmentPeriod: "300s",
            perSeriesAligner: "ALIGN_NEXT_OLDER",
            crossSeriesReducer: "REDUCE_COUNT_FALSE",
            groupByFields: ["resource.label.*"],
          },
        ],
        comparison: "COMPARISON_GT",
        duration: "120s",
        filter: `metric.type="monitoring.googleapis.com/uptime_check/check_passed" AND metric.label.check_id="${uptimeCheckId}" AND resource.type="uptime_url"`,
        thresholdValue: 1,
        trigger: {
          count: 1,
        },
      },
    },
  ],
};

if (notificationChannels.length > 0) {
  policy.notificationChannels = notificationChannels;
}

fs.writeFileSync(outputFile, JSON.stringify(policy, null, 2));
EOF

node - "${BACKEND_FAILURE_POLICY_FILE}" "${BACKEND_FAILURE_POLICY_DISPLAY_NAME}" "${NOTIFICATION_CHANNELS_JSON}" "${CLOUD_RUN_SERVICE}" "${BOOTSTRAP_FAILURE_METRIC}" "${DATABASE_FAILURE_METRIC}" "${REDIS_FAILURE_METRIC}" <<'EOF'
const fs = require("fs");

const [
  outputFile,
  displayName,
  notificationChannelsJson,
  serviceName,
  bootstrapMetric,
  databaseMetric,
  redisMetric,
] = process.argv.slice(2);

const notificationChannels = JSON.parse(notificationChannelsJson);

function thresholdCondition(conditionDisplayName, metricName) {
  return {
    displayName: conditionDisplayName,
    conditionThreshold: {
      aggregations: [
        {
          alignmentPeriod: "300s",
          perSeriesAligner: "ALIGN_SUM",
        },
      ],
      comparison: "COMPARISON_GT",
      duration: "0s",
      filter: `metric.type="logging.googleapis.com/user/${metricName}" AND resource.type="cloud_run_revision"`,
      thresholdValue: 0,
      trigger: {
        count: 1,
      },
    },
  };
}

const policy = {
  displayName,
  combiner: "OR",
  documentation: {
    content: [
      `Critical backend failures were detected for \`${serviceName}\`.`,
      "",
      "This policy watches for:",
      `- bootstrap failures via \`${bootstrapMetric}\``,
      `- database failures via \`${databaseMetric}\``,
      `- Redis and pub/sub failures via \`${redisMetric}\``,
      "",
      "Next steps:",
      "1. Open the incident and identify which condition fired.",
      "2. Use the log queries from `deploy/cloudrun/docs/OPERATIONS.md`.",
      "3. If the latest revision is unhealthy, roll traffic back using the Cloud Run rollback runbook.",
    ].join("\n"),
    mimeType: "text/markdown",
  },
  enabled: true,
  userLabels: {
    module: "cloudrun",
    category: "backendfailures",
    service: serviceName.toLowerCase(),
  },
  conditions: [
    thresholdCondition(`${serviceName} bootstrap failures`, bootstrapMetric),
    thresholdCondition(`${serviceName} database failures`, databaseMetric),
    thresholdCondition(`${serviceName} Redis and pub/sub failures`, redisMetric),
  ],
};

if (notificationChannels.length > 0) {
  policy.notificationChannels = notificationChannels;
}

fs.writeFileSync(outputFile, JSON.stringify(policy, null, 2));
EOF

delete_policies_by_display_name "${UPTIME_POLICY_DISPLAY_NAME}"
gcloud monitoring policies create \
  --project "${PROJECT_ID}" \
  --policy-from-file "${UPTIME_POLICY_FILE}" >/dev/null

delete_policies_by_display_name "${BACKEND_FAILURE_POLICY_DISPLAY_NAME}"
gcloud monitoring policies create \
  --project "${PROJECT_ID}" \
  --policy-from-file "${BACKEND_FAILURE_POLICY_FILE}" >/dev/null

cat <<EOF
Cloud Run monitoring setup complete.

Project:
  ${PROJECT_ID}

Service:
  ${CLOUD_RUN_SERVICE}
  ${SERVICE_URL}

Uptime check:
  ${UPTIME_CHECK_NAME}
  path: ${MONITORING_UPTIME_PATH}

Log-based metrics:
  ${BOOTSTRAP_FAILURE_METRIC}
  ${DATABASE_FAILURE_METRIC}
  ${REDIS_FAILURE_METRIC}

Alert policies:
  ${UPTIME_POLICY_DISPLAY_NAME}
  ${BACKEND_FAILURE_POLICY_DISPLAY_NAME}

Notification channels:
$(if (( ${#NOTIFICATION_CHANNELS[@]} > 0 )); then
  for channel in "${NOTIFICATION_CHANNELS[@]}"; do
    printf '  %s\n' "${channel}"
  done
else
  printf '  none configured (incidents still appear in Cloud Monitoring)\n'
fi)

Next:
  1. If you use email, verify the notification channel if Monitoring marked it unverified.
  2. Open deploy/cloudrun/docs/MONITORING.md for the operational guide.
  3. Optionally run a controlled smoke failure test once you are ready to validate notification delivery.
EOF
