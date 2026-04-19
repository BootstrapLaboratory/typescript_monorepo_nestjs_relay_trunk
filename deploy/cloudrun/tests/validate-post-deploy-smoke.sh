#!/usr/bin/env bash
set -euo pipefail

SERVICE_URL="${1:-${SERVICE_URL:-}}"

if [[ -z "${SERVICE_URL}" ]]; then
  echo "Usage: validate-post-deploy-smoke.sh <service-url>" >&2
  echo "Or set SERVICE_URL in the environment." >&2
  exit 1
fi

SERVICE_URL="${SERVICE_URL%/}"
HEALTH_URL="${SERVICE_URL}/health"
GRAPHQL_URL="${SERVICE_URL}/graphql"
WS_URL="${SERVICE_URL/https:/wss:}"
WS_URL="${WS_URL/http:/ws:}/graphql"

echo "Running deployed backend smoke tests"
echo "  service URL: ${SERVICE_URL}"

export SERVICE_URL HEALTH_URL GRAPHQL_URL WS_URL

node --input-type=module <<'EOF'
import { appendFileSync } from "node:fs";

const serviceUrl = process.env.SERVICE_URL;
const healthUrl = process.env.HEALTH_URL;
const graphqlUrl = process.env.GRAPHQL_URL;
const wsUrl = process.env.WS_URL;

if (!serviceUrl || !healthUrl || !graphqlUrl || !wsUrl) {
  console.error("SERVICE_URL, HEALTH_URL, GRAPHQL_URL, and WS_URL are required.");
  process.exit(1);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const uniqueId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const expectedAuthor = "smoke";
const expectedBody = `post-deploy smoke ${uniqueId}`;
const subscriptionQuery = "subscription { MessageAdded { id author body } }";
const getMessagesQuery = "query { getMessages { id author body } }";
const addMessageMutation =
  "mutation($input: NewMessageInput!) { addMessage(newMessageData: $input) { id author body } }";

async function waitForHealthyService() {
  for (let attempt = 1; attempt <= 24; attempt += 1) {
    try {
      const response = await fetch(healthUrl, {
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      });

      if (response.ok) {
        const json = await response.json();
        if (json?.status === "ok") {
          console.log(`[smoke] Health check passed on attempt ${attempt}.`);
          return json;
        }
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);
      console.log(
        `[smoke] Health check attempt ${attempt} failed: ${message}`,
      );
    }

    await sleep(5_000);
  }

  throw new Error("Timed out waiting for the deployed service health endpoint.");
}

async function postGraphql(query, variables = {}) {
  const response = await fetch(graphqlUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(15_000),
  });

  const json = await response.json();

  if (!response.ok) {
    throw new Error(
      `GraphQL request failed with HTTP ${response.status}: ${JSON.stringify(json)}`,
    );
  }

  if (json.errors) {
    throw new Error(`GraphQL errors: ${JSON.stringify(json.errors)}`);
  }

  return json.data;
}

async function waitForSubscriptionDelivery() {
  return await new Promise((resolve, reject) => {
    let settled = false;
    let socket;
    let triggerTimer;
    let timeoutTimer;

    const cleanup = () => {
      if (triggerTimer) {
        clearTimeout(triggerTimer);
      }

      if (timeoutTimer) {
        clearTimeout(timeoutTimer);
      }

      if (socket && socket.readyState === WebSocket.OPEN) {
        try {
          socket.close(1000, "Smoke complete");
        } catch {}
      }
    };

    const fail = (error) => {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();
      reject(error);
    };

    const succeed = (payload) => {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();
      resolve(payload);
    };

    timeoutTimer = setTimeout(() => {
      fail(
        new Error(
          "Timed out waiting for the GraphQL subscription to receive the smoke-test message.",
        ),
      );
    }, 20_000);

    socket = new WebSocket(`${wsUrl}?probe=post-deploy-smoke-${uniqueId}`, "graphql-transport-ws");

    socket.onopen = () => {
      socket.send(JSON.stringify({ type: "connection_init" }));
    };

    socket.onerror = () => {
      fail(new Error("GraphQL subscription transport error."));
    };

    socket.onclose = (event) => {
      if (settled) {
        return;
      }

      fail(
        new Error(
          `GraphQL subscription closed before the smoke test completed (code ${event.code}${
            event.reason ? `, reason: ${event.reason}` : ""
          }).`,
        ),
      );
    };

    socket.onmessage = async (event) => {
      try {
        const message = JSON.parse(String(event.data));

        if (message.type === "connection_ack") {
          console.log("[smoke] Subscription transport connected.");

          socket.send(
            JSON.stringify({
              id: "message-added",
              type: "subscribe",
              payload: {
                query: subscriptionQuery,
              },
            }),
          );

          triggerTimer = setTimeout(async () => {
            try {
              const mutationData = await postGraphql(addMessageMutation, {
                input: {
                  author: expectedAuthor,
                  body: expectedBody,
                },
              });

              const addedMessage = mutationData?.addMessage;
              if (!addedMessage || addedMessage.body !== expectedBody) {
                fail(
                  new Error(
                    `Unexpected mutation response: ${JSON.stringify(mutationData)}`,
                  ),
                );
                return;
              }

              console.log("[smoke] Mutation succeeded.");
            } catch (error) {
              fail(
                error instanceof Error ? error : new Error(String(error)),
              );
            }
          }, 1_000);

          return;
        }

        if (message.type === "ping") {
          socket.send(JSON.stringify({ type: "pong" }));
          return;
        }

        if (message.type === "pong") {
          return;
        }

        if (message.type === "error") {
          fail(
            new Error(
              `Subscription returned GraphQL errors: ${JSON.stringify(message.payload)}`,
            ),
          );
          return;
        }

        if (message.type === "next") {
          const addedMessage = message.payload?.data?.MessageAdded;
          if (addedMessage?.body === expectedBody) {
            console.log("[smoke] Subscription delivery succeeded.");
            succeed(addedMessage);
          }
        }
      } catch (error) {
        fail(error instanceof Error ? error : new Error(String(error)));
      }
    };
  });
}

function appendStepSummary(lines) {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (!summaryPath) {
    return;
  }

  appendFileSync(summaryPath, `${lines.join("\n")}\n`);
}

async function main() {
  await waitForHealthyService();

  const queryData = await postGraphql(getMessagesQuery);
  if (!Array.isArray(queryData?.getMessages)) {
    throw new Error(
      `Expected getMessages to return an array: ${JSON.stringify(queryData)}`,
    );
  }

  console.log(
    `[smoke] Query succeeded with ${queryData.getMessages.length} messages currently in the store.`,
  );

  const deliveredMessage = await waitForSubscriptionDelivery();

  appendStepSummary([
    "### Cloud Run Smoke Test",
    "",
    `- Service URL: \`${serviceUrl}\``,
    `- Health check: passed`,
    `- GraphQL query: passed`,
    `- GraphQL mutation: passed`,
    `- GraphQL subscription delivery: passed`,
    `- Smoke test message body: \`${deliveredMessage.body}\``,
  ]);

  console.log("[smoke] Deployed backend smoke test passed.");
}

main().catch((error) => {
  console.error(
    `[smoke] ${error instanceof Error ? error.stack ?? error.message : String(error)}`,
  );
  process.exit(1);
});
EOF
