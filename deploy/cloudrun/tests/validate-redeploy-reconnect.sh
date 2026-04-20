#!/usr/bin/env bash
set -euo pipefail

TEST_SCRIPT_PATH="$(readlink -f -- "${BASH_SOURCE[0]}")"
TEST_SCRIPT_DIR="$(cd -- "$(dirname -- "${TEST_SCRIPT_PATH}")" && pwd)"
# shellcheck disable=SC1091
source "${TEST_SCRIPT_DIR}/../scripts/lib/paths.sh"
# shellcheck disable=SC1091
source "${SCRIPTS_DIR}/load-env.sh"

require_env() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "Missing required environment variable: ${name}" >&2
    exit 1
  fi
}

require_env PROJECT_ID
require_env CLOUD_RUN_SERVICE
require_env CLOUD_RUN_REGION

RUN_ID="redeploy-reconnect-$(date +%s)"
START_TIMESTAMP="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
EXPECTED_BODY="redeploy reconnect smoke $(date +%s)"
STATE_FILE="$(mktemp)"
SUBSCRIPTION_LOG_FILE="$(mktemp)"
PROBE_PID=""

cleanup() {
  local exit_code=$?

  if [[ -n "${PROBE_PID}" ]] && kill -0 "${PROBE_PID}" 2>/dev/null; then
    kill "${PROBE_PID}" 2>/dev/null || true
    wait "${PROBE_PID}" 2>/dev/null || true
  fi

  rm -f "${STATE_FILE}" "${SUBSCRIPTION_LOG_FILE}"
  exit "${exit_code}"
}

trap cleanup EXIT

PROJECT_NUMBER="$(
  gcloud projects describe "${PROJECT_ID}" \
    --format='value(projectNumber)'
)"

SERVICE_URL="https://${CLOUD_RUN_SERVICE}-${PROJECT_NUMBER}.${CLOUD_RUN_REGION}.run.app"
WS_URL="${SERVICE_URL/https:/wss:}/graphql?probe=${RUN_ID}"
HEALTH_URL="${SERVICE_URL}/health"
GRAPHQL_URL="${SERVICE_URL}/graphql?probe=${RUN_ID}&kind=publish"

echo "Cloud Run redeploy reconnect validation"
echo "  project: ${PROJECT_ID}"
echo "  service: ${CLOUD_RUN_SERVICE}"
echo "  region: ${CLOUD_RUN_REGION}"
echo "  deterministic service URL: ${SERVICE_URL}"
echo "  probe run id: ${RUN_ID}"
echo "  expected message body: ${EXPECTED_BODY}"

export WS_URL STATE_FILE EXPECTED_BODY TOTAL_TIMEOUT_MS=900000
node "${TESTS_DIR}/restart-reconnect-probe.mjs" &
PROBE_PID="$!"

echo "Waiting for the initial subscription connection..."
for ((attempt = 1; attempt <= 60; attempt += 1)); do
  if node -e '
    const fs = require("fs");
    const file = process.argv[1];
    try {
      const state = JSON.parse(fs.readFileSync(file, "utf8"));
      process.exit(state.connectedCount >= 1 ? 0 : 1);
    } catch {
      process.exit(1);
    }
  ' "${STATE_FILE}"; then
    break
  fi

  sleep 2

  if (( attempt == 60 )); then
    echo "Timed out waiting for the initial subscription connection." >&2
    exit 1
  fi
done

echo "Deleting the Cloud Run service to force a hard reconnect..."
gcloud run services delete "${CLOUD_RUN_SERVICE}" \
  --project "${PROJECT_ID}" \
  --region "${CLOUD_RUN_REGION}" \
  --quiet

echo "Triggering the GitHub Actions backend deploy workflow..."
TRIGGERED_AT="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
gh workflow run ci-release.yaml --ref main -f force_server=true >/dev/null

RUN_DATABASE_ID=""
echo "Waiting for the workflow dispatch run to appear..."
for ((attempt = 1; attempt <= 30; attempt += 1)); do
  RUN_DATABASE_ID="$(
    gh run list \
      --workflow ci-release.yaml \
      --limit 10 \
      --json databaseId,event,createdAt \
      | node -e '
          const runs = JSON.parse(require("fs").readFileSync(0, "utf8"));
          const triggeredAt = Date.parse(process.argv[1]);
          const candidate = runs.find((run) => {
            return (
              run.event === "workflow_dispatch" &&
              Date.parse(run.createdAt) >= triggeredAt
            );
          });
          process.stdout.write(candidate ? String(candidate.databaseId) : "");
        ' "${TRIGGERED_AT}"
  )"

  if [[ -n "${RUN_DATABASE_ID}" ]]; then
    break
  fi

  sleep 5

  if (( attempt == 30 )); then
    echo "Timed out waiting for the GitHub Actions run to appear." >&2
    exit 1
  fi
done

echo "Watching GitHub Actions run ${RUN_DATABASE_ID}..."
gh run watch "${RUN_DATABASE_ID}" --exit-status

echo "Waiting for Cloud Run health to recover..."
for ((attempt = 1; attempt <= 90; attempt += 1)); do
  if curl -fsS "${HEALTH_URL}" >/dev/null; then
    break
  fi

  sleep 5

  if (( attempt == 90 )); then
    echo "Timed out waiting for the Cloud Run service health endpoint." >&2
    exit 1
  fi
done

echo "Publishing a post-redeploy GraphQL mutation..."
curl -fsS \
  -H 'content-type: application/json' \
  --data "{\"query\":\"mutation(\$input: NewMessageInput!) { addMessage(newMessageData: \$input) { id author body } }\",\"variables\":{\"input\":{\"author\":\"smoke\",\"body\":\"${EXPECTED_BODY}\"}}}" \
  "${GRAPHQL_URL}" >/dev/null

echo "Waiting for the subscription probe to confirm recovery..."
wait "${PROBE_PID}"
PROBE_PID=""

CONNECTED_COUNT="$(
  node -e '
    const state = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
    process.stdout.write(String(state.connectedCount ?? 0));
  ' "${STATE_FILE}"
)"

RECONNECT_COUNT="$(
  node -e '
    const state = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
    process.stdout.write(String(state.reconnectCount ?? 0));
  ' "${STATE_FILE}"
)"

LAST_CLOSE_CODE="$(
  node -e '
    const state = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
    process.stdout.write(
      state.lastCloseCode === null || state.lastCloseCode === undefined
        ? ""
        : String(state.lastCloseCode),
    );
  ' "${STATE_FILE}"
)"

echo "Reading Cloud Logging evidence for the validation window..."
gcloud logging read \
  "timestamp >= \"${START_TIMESTAMP}\" AND resource.type=\"cloud_run_revision\" AND resource.labels.service_name=\"${CLOUD_RUN_SERVICE}\" AND resource.labels.location=\"${CLOUD_RUN_REGION}\" AND (textPayload:\"graphql_subscription_connect\" OR textPayload:\"graphql_subscription_disconnect\")" \
  --project "${PROJECT_ID}" \
  --limit 20 \
  --order=asc \
  --format=json > "${SUBSCRIPTION_LOG_FILE}"

SUBSCRIPTION_LOG_COUNT="$(
  node -e '
    const logs = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
    process.stdout.write(String(logs.length));
  ' "${SUBSCRIPTION_LOG_FILE}"
)"

if (( CONNECTED_COUNT < 2 || RECONNECT_COUNT < 1 )); then
  cat <<EOF >&2
The live probe confirmed post-redeploy delivery, but it did not observe a full reconnect cycle.

Probe state:
  connectedCount: ${CONNECTED_COUNT}
  reconnectCount: ${RECONNECT_COUNT}
  lastCloseCode: ${LAST_CLOSE_CODE:-none}

This means Cloud Run service deletion + redeploy was not a reliable forced-disconnect trigger in this run.
That makes this script useful as a live diagnostic, but not a definitive approval test for browser reconnect behavior.
For final reconnect validation, keep the browser/manual offline-recovery check in the runbook.
EOF
  exit 1
fi

echo "Redeploy reconnect validation succeeded."
echo "  probe run id: ${RUN_ID}"
echo "  service URL: ${SERVICE_URL}"
echo "  probe connectedCount: ${CONNECTED_COUNT}"
echo "  probe reconnectCount: ${RECONNECT_COUNT}"
echo "  validation-window subscription log count: ${SUBSCRIPTION_LOG_COUNT}"
echo "  expected message body: ${EXPECTED_BODY}"
