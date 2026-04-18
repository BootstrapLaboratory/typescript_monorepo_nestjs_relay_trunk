import { useSyncExternalStore } from "react";
import { createClient, type Client } from "graphql-ws";

export type GraphqlWsConnectionStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "retrying"
  | "disconnected";

export type GraphqlWsConnectionState = {
  status: GraphqlWsConnectionStatus;
  attempt: number;
  closeCode: number | null;
  detail: string | null;
  browserOnline: boolean;
};

type CloseLike = {
  code?: number;
  reason?: string;
};

const HEARTBEAT_INTERVAL_MS = 10_000;
const HEARTBEAT_TIMEOUT_MS = 5_000;
const FATAL_CLOSE_CODES = new Set([4400, 4401, 4403, 4406, 4409, 4429]);
const listeners = new Set<() => void>();
const SHOULD_LOG_RECONNECTS =
  import.meta.env.VITE_GRAPHQL_LOG_RECONNECTS === "true";

let connectionState: GraphqlWsConnectionState = {
  status: "idle",
  attempt: 0,
  closeCode: null,
  detail: null,
  browserOnline:
    typeof navigator === "undefined" ? true : Boolean(navigator.onLine),
};

let browserNetworkListenersInitialized = false;
let heartbeatTimeout: ReturnType<typeof setTimeout> | undefined;

function emitConnectionStateChange(): void {
  for (const listener of listeners) {
    listener();
  }
}

function logRealtime(message: string, details?: Record<string, unknown>): void {
  if (!SHOULD_LOG_RECONNECTS) {
    return;
  }

  if (details) {
    console.info(`[realtime] ${message}`, details);
    return;
  }

  console.info(`[realtime] ${message}`);
}

function setConnectionState(
  nextState: Partial<GraphqlWsConnectionState>,
): void {
  connectionState = {
    ...connectionState,
    ...nextState,
  };
  emitConnectionStateChange();
}

function isCloseLike(value: unknown): value is CloseLike {
  return typeof value === "object" && value !== null && "code" in value;
}

function getCloseDetail(event: CloseLike): string | null {
  if (!event.reason) {
    return null;
  }

  return event.reason.trim() || null;
}

function isFatalCloseCode(code: number | undefined): boolean {
  return typeof code === "number" && FATAL_CLOSE_CODES.has(code);
}

function clearHeartbeatTimeout(): void {
  if (heartbeatTimeout) {
    clearTimeout(heartbeatTimeout);
    heartbeatTimeout = undefined;
  }
}

function initializeBrowserNetworkListeners(): void {
  if (
    browserNetworkListenersInitialized ||
    typeof window === "undefined" ||
    typeof navigator === "undefined"
  ) {
    return;
  }

  browserNetworkListenersInitialized = true;

  const syncBrowserNetworkState = () => {
    setConnectionState({
      browserOnline: Boolean(navigator.onLine),
      detail: navigator.onLine
        ? connectionState.detail
        : "The browser is offline.",
    });
  };

  window.addEventListener("offline", syncBrowserNetworkState);
  window.addEventListener("online", syncBrowserNetworkState);
  syncBrowserNetworkState();
}

export function createRealtimeGraphqlWsClient(url: string): Client {
  initializeBrowserNetworkListeners();
  const wsClient: Client = createClient({
    url,
    lazy: true,
    keepAlive: HEARTBEAT_INTERVAL_MS,
    connectionAckWaitTimeout: 15_000,
    retryAttempts: Number.POSITIVE_INFINITY,
    retryWait: async (retries) => {
      const cappedRetries = Math.min(retries, 4);
      const baseDelayMs = 1_000 * 2 ** cappedRetries;
      const jitterMs = Math.floor(Math.random() * 1_000);
      await new Promise((resolve) =>
        setTimeout(resolve, Math.min(baseDelayMs + jitterMs, 15_000)),
      );
    },
    shouldRetry: (eventOrError) => {
      if (isCloseLike(eventOrError)) {
        return !isFatalCloseCode(eventOrError.code);
      }

      return true;
    },
    on: {
      connecting: (isRetrying) => {
        clearHeartbeatTimeout();
        setConnectionState({
          status: isRetrying ? "retrying" : "connecting",
          attempt: isRetrying ? connectionState.attempt + 1 : 0,
          closeCode: null,
          detail: null,
        });
        logRealtime(
          isRetrying
            ? "Attempting to reconnect the live GraphQL connection."
            : "Opening the live GraphQL connection.",
          { attempt: isRetrying ? connectionState.attempt + 1 : 0 },
        );
      },
      connected: (_socket, _payload, wasRetry) => {
        clearHeartbeatTimeout();
        setConnectionState({
          status: "connected",
          attempt: 0,
          closeCode: null,
          detail: null,
        });
        logRealtime(
          wasRetry
            ? "Live GraphQL connection re-established."
            : "Live GraphQL connection established.",
        );
      },
      ping: (received) => {
        if (received) {
          return;
        }

        clearHeartbeatTimeout();
        heartbeatTimeout = setTimeout(() => {
          setConnectionState({
            status: "retrying",
            detail: "Live updates heartbeat timed out.",
          });
          logRealtime("No pong received in time. Terminating stuck socket.");
          wsClient.terminate();
        }, HEARTBEAT_TIMEOUT_MS);
      },
      pong: (received) => {
        if (!received) {
          return;
        }

        clearHeartbeatTimeout();
      },
      closed: (event) => {
        clearHeartbeatTimeout();
        if (!isCloseLike(event)) {
          setConnectionState({
            status: "retrying",
            closeCode: null,
            detail: "The live connection closed unexpectedly.",
          });
          logRealtime("Live GraphQL connection closed unexpectedly.");
          return;
        }

        setConnectionState({
          status: isFatalCloseCode(event.code) ? "disconnected" : "retrying",
          closeCode: event.code ?? null,
          detail: getCloseDetail(event),
        });
        logRealtime("Live GraphQL connection closed.", {
          code: event.code ?? null,
          reason: getCloseDetail(event),
          fatal: isFatalCloseCode(event.code),
        });
      },
      error: (error) => {
        if (
          connectionState.status === "connecting" ||
          connectionState.status === "retrying"
        ) {
          return;
        }

        setConnectionState({
          status: "retrying",
          detail: "The live connection hit a transport error.",
        });
        logRealtime("Live GraphQL connection hit a transport error.", {
          error:
            error instanceof Error ? error.message : String(error ?? "unknown"),
        });
      },
    },
  });

  return wsClient;
}

export function subscribeToRealtimeConnectionState(
  listener: () => void,
): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

export function getRealtimeConnectionState(): GraphqlWsConnectionState {
  return connectionState;
}

export function useRealtimeConnectionState(): GraphqlWsConnectionState {
  return useSyncExternalStore(
    subscribeToRealtimeConnectionState,
    getRealtimeConnectionState,
  );
}

export function getRealtimeConnectionMessage(
  state: GraphqlWsConnectionState,
): string | null {
  if (!state.browserOnline) {
    return "Browser is offline. Live updates will reconnect when the network returns.";
  }

  switch (state.status) {
    case "idle":
    case "connected":
      return null;
    case "connecting":
      return "Connecting live updates...";
    case "retrying":
      return state.attempt > 1
        ? `Reconnecting live updates... attempt ${state.attempt}`
        : "Reconnecting live updates...";
    case "disconnected": {
      const reason = state.detail ? ` ${state.detail}` : "";
      return `Live updates disconnected.${reason}`;
    }
  }
}
