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

require_env PROJECT_ID
require_env CLOUD_RUN_SERVICE
require_env CLOUD_RUN_REGION

TARGET_MIN_INSTANCES="${TARGET_MIN_INSTANCES:-2}"
LOG_POLL_ATTEMPTS="${LOG_POLL_ATTEMPTS:-8}"
LOG_POLL_SLEEP_SECONDS="${LOG_POLL_SLEEP_SECONDS:-5}"
SERVICE_READY_ATTEMPTS="${SERVICE_READY_ATTEMPTS:-60}"
SERVICE_READY_SLEEP_SECONDS="${SERVICE_READY_SLEEP_SECONDS:-5}"

RUN_ID="multi-instance-$(date +%s)"
START_TIMESTAMP="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
SUMMARY_FILE="$(mktemp)"
LOGS_FILE="$(mktemp)"

cleanup_files() {
  rm -f "${SUMMARY_FILE}" "${LOGS_FILE}"
}

read_service_json() {
  gcloud run services describe "${CLOUD_RUN_SERVICE}" \
    --project "${PROJECT_ID}" \
    --region "${CLOUD_RUN_REGION}" \
    --format=json
}

extract_service_field() {
  local service_json="$1"
  local field="$2"
  node -e '
    const data = JSON.parse(process.argv[1]);
    const field = process.argv[2];
    const annotations = data.spec?.template?.metadata?.annotations ?? {};
    if (field === "url") {
      process.stdout.write(data.status?.url ?? "");
    } else if (field === "min") {
      process.stdout.write(
        String(
          annotations["autoscaling.knative.dev/minScale"] ??
            annotations["run.googleapis.com/minScale"] ??
            0,
        ),
      );
    } else if (field === "concurrency") {
      process.stdout.write(
        String(data.spec?.template?.spec?.containerConcurrency ?? 80),
      );
    } else if (field === "ready") {
      const ready =
        data.status?.conditions?.find((condition) => condition.type === "Ready")
          ?.status ?? "False";
      process.stdout.write(String(ready));
    } else if (field === "latestReadyRevision") {
      process.stdout.write(data.status?.latestReadyRevisionName ?? "");
    } else if (field === "latestCreatedRevision") {
      process.stdout.write(data.status?.latestCreatedRevisionName ?? "");
    } else {
      process.exit(1);
    }
  ' "${service_json}" "${field}"
}

wait_for_service_ready() {
  local description_json=""
  local attempt=0

  while (( attempt < SERVICE_READY_ATTEMPTS )); do
    description_json="$(read_service_json)"
    local ready_status
    ready_status="$(extract_service_field "${description_json}" ready)"
    local latest_ready
    latest_ready="$(extract_service_field "${description_json}" latestReadyRevision)"
    local latest_created
    latest_created="$(extract_service_field "${description_json}" latestCreatedRevision)"

    if [[ "${ready_status}" == "True" ]] && [[ -n "${latest_ready}" ]] && [[ "${latest_ready}" == "${latest_created}" ]]; then
      printf '%s' "${description_json}"
      return 0
    fi

    sleep "${SERVICE_READY_SLEEP_SECONDS}"
    ((attempt += 1))
  done

  echo "Timed out waiting for Cloud Run service ${CLOUD_RUN_SERVICE} to become ready." >&2
  return 1
}

ORIGINAL_SERVICE_JSON="$(read_service_json)"
ORIGINAL_MIN_INSTANCES="$(extract_service_field "${ORIGINAL_SERVICE_JSON}" min)"
SERVICE_URL="$(extract_service_field "${ORIGINAL_SERVICE_JSON}" url)"
CONCURRENCY_LIMIT="$(extract_service_field "${ORIGINAL_SERVICE_JSON}" concurrency)"

if [[ -z "${SERVICE_URL}" ]]; then
  echo "Could not determine the Cloud Run service URL." >&2
  exit 1
fi

SUBSCRIBER_COUNT="${SUBSCRIBER_COUNT:-$(( CONCURRENCY_LIMIT + 5 ))}"

restore_original_min_instances() {
  if [[ "${RESTORE_SKIPPED:-0}" == "1" ]]; then
    return 0
  fi

  if [[ "${ORIGINAL_MIN_INSTANCES}" == "${TARGET_MIN_INSTANCES}" ]]; then
    return 0
  fi

  echo "Restoring min instances to ${ORIGINAL_MIN_INSTANCES}..."
  gcloud run services update "${CLOUD_RUN_SERVICE}" \
    --project "${PROJECT_ID}" \
    --region "${CLOUD_RUN_REGION}" \
    --min-instances "${ORIGINAL_MIN_INSTANCES}" \
    --quiet >/dev/null
  wait_for_service_ready >/dev/null
}

cleanup() {
  local exit_code=$?
  restore_original_min_instances || true
  cleanup_files
  exit "${exit_code}"
}

trap cleanup EXIT

echo "Cloud Run multi-instance validation"
echo "  project: ${PROJECT_ID}"
echo "  service: ${CLOUD_RUN_SERVICE}"
echo "  region: ${CLOUD_RUN_REGION}"
echo "  url: ${SERVICE_URL}"
echo "  original min instances: ${ORIGINAL_MIN_INSTANCES}"
echo "  target min instances: ${TARGET_MIN_INSTANCES}"
echo "  subscriber count: ${SUBSCRIBER_COUNT}"
echo "  probe run id: ${RUN_ID}"

if [[ "${ORIGINAL_MIN_INSTANCES}" != "${TARGET_MIN_INSTANCES}" ]]; then
  echo "Scaling service to min instances = ${TARGET_MIN_INSTANCES}..."
  gcloud run services update "${CLOUD_RUN_SERVICE}" \
    --project "${PROJECT_ID}" \
    --region "${CLOUD_RUN_REGION}" \
    --min-instances "${TARGET_MIN_INSTANCES}" \
    --quiet >/dev/null
fi

READY_SERVICE_JSON="$(wait_for_service_ready)"
SERVICE_URL="$(extract_service_field "${READY_SERVICE_JSON}" url)"

export SERVICE_URL RUN_ID SUBSCRIBER_COUNT SUMMARY_FILE
node --input-type=module <<'EOF'
import { writeFileSync } from "node:fs";

const serviceUrl = process.env.SERVICE_URL;
const runId = process.env.RUN_ID;
const subscriberCount = Number(process.env.SUBSCRIBER_COUNT);
const summaryFile = process.env.SUMMARY_FILE;

const wsBase = serviceUrl.replace(/^https:/, "wss:");
const httpBase = `${serviceUrl}/graphql`;
const expectedBody = `multi-instance smoke ${Date.now()}`;
const subscriptionQuery = "subscription { MessageAdded { id author body } }";
const mutationQuery =
  "mutation($input: NewMessageInput!) { addMessage(newMessageData: $input) { id author body } }";
const requestTimeoutMs = 30000;

const sockets = [];
const seenSubscribers = new Set();
let ackCount = 0;
let publishTriggered = false;
let settled = false;

const result = {
  runId,
  subscriberCount,
  expectedBody,
  ackCount: 0,
  seenSubscriberIndexes: [],
  mutationResponse: null,
};

const finish = (status, details) => {
  if (settled) {
    return;
  }
  settled = true;
  clearTimeout(timeout);
  for (const socket of sockets) {
    try {
      socket.close();
    } catch {}
  }
  const summary = {
    status,
    ...result,
    ...details,
  };
  writeFileSync(summaryFile, `${JSON.stringify(summary, null, 2)}\n`);
  if (status !== "ok") {
    console.error(summary.message ?? "Multi-instance probe failed.");
    process.exit(1);
  }
  console.log(summary.message);
  process.exit(0);
};

const maybePublish = async () => {
  if (publishTriggered || ackCount !== subscriberCount) {
    return;
  }

  publishTriggered = true;
  try {
    const response = await fetch(`${httpBase}?probe=${runId}&kind=publish`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        query: mutationQuery,
        variables: {
          input: {
            author: "smoke",
            body: expectedBody,
          },
        },
      }),
    });

    const json = await response.json();
    result.mutationResponse = json;

    if (!response.ok) {
      finish("error", {
        message: `Publish mutation failed with HTTP ${response.status}.`,
      });
      return;
    }

    if (json.errors) {
      finish("error", {
        message: `Publish mutation returned errors: ${JSON.stringify(json.errors)}`,
      });
      return;
    }
  } catch (error) {
    finish("error", {
      message: `Publish mutation threw: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
};

const timeout = setTimeout(() => {
  finish("error", {
    message: "Timed out waiting for all subscriptions to receive the published event.",
  });
}, requestTimeoutMs);

for (let index = 1; index <= subscriberCount; index += 1) {
  const socket = new WebSocket(
    `${wsBase}/graphql?probe=${runId}&kind=sub&subscriber=${index}`,
    "graphql-transport-ws",
  );
  sockets.push(socket);

  socket.addEventListener("open", () => {
    socket.send(JSON.stringify({ type: "connection_init" }));
  });

  socket.addEventListener("message", (event) => {
    const payload = JSON.parse(event.data.toString());

    if (payload.type === "connection_ack") {
      ackCount += 1;
      result.ackCount = ackCount;
      socket.send(
        JSON.stringify({
          id: String(index),
          type: "subscribe",
          payload: {
            query: subscriptionQuery,
          },
        }),
      );
      void maybePublish();
      return;
    }

    if (payload.type === "next") {
      const body = payload.payload?.data?.MessageAdded?.body;
      if (body === expectedBody) {
        seenSubscribers.add(index);
        result.seenSubscriberIndexes = Array.from(seenSubscribers).sort(
          (left, right) => left - right,
        );
        if (seenSubscribers.size === subscriberCount) {
          finish("ok", {
            message: `All ${subscriberCount} subscribers received the cross-instance event.`,
          });
        }
      }
      return;
    }

    if (payload.type === "error") {
      finish("error", {
        message: `Subscriber ${index} returned errors: ${JSON.stringify(payload.payload)}`,
      });
    }
  });

  socket.addEventListener("close", (event) => {
    if (!settled && !seenSubscribers.has(index)) {
      finish("error", {
        message: `Subscriber ${index} closed before receiving the event (code=${event.code}).`,
      });
    }
  });

  socket.addEventListener("error", () => {
    if (!settled) {
      finish("error", {
        message: `Subscriber ${index} encountered a WebSocket error.`,
      });
    }
  });
}
EOF

echo "Waiting for Cloud Logging request entries..."

for ((attempt = 1; attempt <= LOG_POLL_ATTEMPTS; attempt += 1)); do
  gcloud logging read \
    "timestamp >= \"${START_TIMESTAMP}\" AND resource.type=\"cloud_run_revision\" AND resource.labels.service_name=\"${CLOUD_RUN_SERVICE}\" AND resource.labels.location=\"${CLOUD_RUN_REGION}\" AND logName=\"projects/${PROJECT_ID}/logs/run.googleapis.com%2Frequests\" AND httpRequest.requestUrl:\"probe=${RUN_ID}\"" \
    --project "${PROJECT_ID}" \
    --limit 200 \
    --format=json > "${LOGS_FILE}"

  if [[ -s "${LOGS_FILE}" ]]; then
    export LOGS_FILE SUMMARY_FILE
    UNIQUE_INSTANCE_COUNT="$(node --input-type=module <<'EOF'
import { readFileSync, writeFileSync } from "node:fs";

const logs = JSON.parse(readFileSync(process.env.LOGS_FILE, "utf8"));
const summary = JSON.parse(readFileSync(process.env.SUMMARY_FILE, "utf8"));

const bucket = new Map();
const subscribers = new Map();

for (const entry of logs) {
  const requestUrl = entry.httpRequest?.requestUrl ?? "";
  const instanceId = entry.labels?.instanceId ?? "unknown";
  bucket.set(instanceId, (bucket.get(instanceId) ?? 0) + 1);

  const match = requestUrl.match(/[?&]subscriber=(\d+)/);
  if (match) {
    subscribers.set(match[1], instanceId);
  }
}

summary.logAnalysis = {
  requestLogCount: logs.length,
  uniqueInstanceIds: Array.from(bucket.keys()),
  requestsPerInstance: Object.fromEntries(bucket),
  subscriberInstanceIds: Object.fromEntries(subscribers),
};

writeFileSync(process.env.SUMMARY_FILE, `${JSON.stringify(summary, null, 2)}\n`);
process.stdout.write(String(bucket.size));
EOF
)"

    SUBSCRIBER_INSTANCE_COUNT="$(node --input-type=module <<'EOF'
import { readFileSync } from "node:fs";

const summary = JSON.parse(readFileSync(process.env.SUMMARY_FILE, "utf8"));
const subscriberInstances = new Set(
  Object.values(summary.logAnalysis?.subscriberInstanceIds ?? {}),
);
process.stdout.write(String(subscriberInstances.size));
EOF
)"

    if (( UNIQUE_INSTANCE_COUNT >= 2 )) && (( SUBSCRIBER_INSTANCE_COUNT >= 2 )); then
      break
    fi
  fi

  sleep "${LOG_POLL_SLEEP_SECONDS}"
done

node --input-type=module <<'EOF'
import { readFileSync } from "node:fs";

const summary = JSON.parse(readFileSync(process.env.SUMMARY_FILE, "utf8"));

if (summary.status !== "ok") {
  console.error("Application-level multi-instance probe did not complete successfully.");
  process.exit(1);
}

const uniqueInstances = new Set(summary.logAnalysis?.uniqueInstanceIds ?? []);
const subscriberInstances = new Set(
  Object.values(summary.logAnalysis?.subscriberInstanceIds ?? {}),
);

if (uniqueInstances.size < 2) {
  console.error(
    `Probe traffic only reached ${uniqueInstances.size} instance(s); expected at least 2.`,
  );
  process.exit(1);
}

if (subscriberInstances.size < 2) {
  console.error(
    `Subscription connections only reached ${subscriberInstances.size} instance(s); expected at least 2.`,
  );
  process.exit(1);
}

console.log("Multi-instance validation succeeded.");
console.log(`  total instances observed in request logs: ${uniqueInstances.size}`);
console.log(`  subscriber instances observed: ${subscriberInstances.size}`);
console.log(`  subscribers confirmed: ${summary.seenSubscriberIndexes.length}/${summary.subscriberCount}`);
console.log(`  published body: ${summary.expectedBody}`);
console.log(`  request logs captured: ${summary.logAnalysis.requestLogCount}`);
console.log("  requests per instance:");
for (const [instanceId, count] of Object.entries(summary.logAnalysis.requestsPerInstance)) {
  console.log(`    ${instanceId}: ${count}`);
}
EOF
