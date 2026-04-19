#!/usr/bin/env node

import { writeFileSync } from "node:fs";

const wsUrl = process.env.WS_URL;
const stateFile = process.env.STATE_FILE;
const expectedBody = process.env.EXPECTED_BODY;
const totalTimeoutMs = Number(process.env.TOTAL_TIMEOUT_MS ?? "900000");

if (!wsUrl || !stateFile || !expectedBody) {
  console.error("WS_URL, STATE_FILE, and EXPECTED_BODY are required.");
  process.exit(1);
}

const subscriptionQuery = "subscription { MessageAdded { id author body } }";
const reconnectDelayMs = 2_000;
const heartbeatIntervalMs = 10_000;
const heartbeatTimeoutMs = 5_000;

let settled = false;
let socket;
let connectTimer;
let heartbeatInterval;
let heartbeatTimeout;

const state = {
  status: "starting",
  connectionAttempts: 0,
  connectedCount: 0,
  reconnectCount: 0,
  receivedExpectedBody: false,
  expectedBody,
  lastCloseCode: null,
  lastCloseReason: null,
  lastError: null,
  heartbeatTimeouts: 0,
  startedAt: new Date().toISOString(),
  completedAt: null,
};

function persistState() {
  writeFileSync(stateFile, `${JSON.stringify(state, null, 2)}\n`);
}

function log(message, details) {
  if (details) {
    console.log(`[probe] ${message}`, details);
    return;
  }

  console.log(`[probe] ${message}`);
}

function cleanupTimers() {
  if (connectTimer) {
    clearTimeout(connectTimer);
    connectTimer = undefined;
  }

  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = undefined;
  }

  if (heartbeatTimeout) {
    clearTimeout(heartbeatTimeout);
    heartbeatTimeout = undefined;
  }
}

function finish(exitCode, message) {
  if (settled) {
    return;
  }

  settled = true;
  cleanupTimers();
  state.status = exitCode === 0 ? "succeeded" : "failed";
  state.completedAt = new Date().toISOString();
  persistState();

  if (socket && socket.readyState === WebSocket.OPEN) {
    try {
      socket.close(1000, "Probe complete");
    } catch {}
  }

  if (message) {
    log(message);
  }

  process.exit(exitCode);
}

function scheduleReconnect(reason) {
  if (settled) {
    return;
  }

  cleanupTimers();
  state.status = "retrying";
  state.lastError = reason;
  state.reconnectCount += 1;
  persistState();
  log("Scheduling reconnect.", {
    reason,
    reconnectCount: state.reconnectCount,
  });

  connectTimer = setTimeout(() => {
    connect();
  }, reconnectDelayMs);
}

function armHeartbeat() {
  cleanupTimers();
  heartbeatInterval = setInterval(() => {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return;
    }

    try {
      socket.send(JSON.stringify({ type: "ping" }));
    } catch (error) {
      scheduleReconnect(
        `Failed to send heartbeat ping: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return;
    }

    heartbeatTimeout = setTimeout(() => {
      state.heartbeatTimeouts += 1;
      persistState();
      log("Heartbeat pong timed out; closing socket.");

      try {
        socket.close(4499, "Heartbeat timeout");
      } catch {}
    }, heartbeatTimeoutMs);
  }, heartbeatIntervalMs);
}

function handleMessage(rawMessage) {
  const message = JSON.parse(String(rawMessage));

  if (message.type === "connection_ack") {
    state.connectedCount += 1;
    state.status = "connected";
    state.lastError = null;
    persistState();

    log("Subscription transport connected.", {
      connectedCount: state.connectedCount,
    });

    armHeartbeat();
    socket.send(
      JSON.stringify({
        id: "message-added",
        type: "subscribe",
        payload: {
          query: subscriptionQuery,
        },
      }),
    );
    return;
  }

  if (message.type === "pong") {
    if (heartbeatTimeout) {
      clearTimeout(heartbeatTimeout);
      heartbeatTimeout = undefined;
    }
    return;
  }

  if (message.type === "ping") {
    socket.send(JSON.stringify({ type: "pong" }));
    return;
  }

  if (message.type === "next") {
    const body = message.payload?.data?.MessageAdded?.body;
    if (body === expectedBody) {
      state.receivedExpectedBody = true;
      persistState();
      finish(
        0,
        `Received the expected post-redeploy message after ${state.connectedCount} connection(s).`,
      );
    }
    return;
  }

  if (message.type === "error") {
    state.lastError = JSON.stringify(message.payload);
    persistState();
    log("Subscription returned GraphQL errors.", {
      payload: message.payload,
    });
  }
}

function connect() {
  if (settled) {
    return;
  }

  state.connectionAttempts += 1;
  state.status = state.connectedCount > 0 ? "retrying" : "connecting";
  persistState();
  log("Opening subscription probe socket.", {
    attempt: state.connectionAttempts,
    wsUrl,
  });

  socket = new WebSocket(wsUrl, "graphql-transport-ws");

  socket.onopen = () => {
    log("Socket opened.");
    socket.send(JSON.stringify({ type: "connection_init" }));
  };

  socket.onmessage = (event) => {
    try {
      handleMessage(event.data);
    } catch (error) {
      state.lastError = error instanceof Error ? error.message : String(error);
      persistState();
      log("Failed to process WebSocket message.", {
        error: state.lastError,
      });
    }
  };

  socket.onerror = () => {
    state.lastError = "WebSocket transport error";
    persistState();
    log("Socket transport error.");
  };

  socket.onclose = (event) => {
    cleanupTimers();
    state.lastCloseCode = event.code ?? null;
    state.lastCloseReason = event.reason ?? null;
    persistState();
    log("Socket closed.", {
      code: event.code ?? null,
      reason: event.reason ?? null,
    });

    if (!settled) {
      scheduleReconnect(
        `Socket closed with code ${event.code ?? "unknown"}${
          event.reason ? ` (${event.reason})` : ""
        }`,
      );
    }
  };
}

persistState();
connect();

setTimeout(() => {
  finish(1, "Reconnect probe timed out before the expected message arrived.");
}, totalTimeoutMs);
