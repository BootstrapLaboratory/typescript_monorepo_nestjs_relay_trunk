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
};

type CloseLike = {
  code?: number;
  reason?: string;
};

const FATAL_CLOSE_CODES = new Set([4400, 4401, 4403, 4406, 4409, 4429]);
const listeners = new Set<() => void>();

let connectionState: GraphqlWsConnectionState = {
  status: "idle",
  attempt: 0,
  closeCode: null,
  detail: null,
};

function emitConnectionStateChange(): void {
  for (const listener of listeners) {
    listener();
  }
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

export function createRealtimeGraphqlWsClient(url: string): Client {
  return createClient({
    url,
    lazy: true,
    keepAlive: 15_000,
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
        setConnectionState({
          status: isRetrying ? "retrying" : "connecting",
          attempt: isRetrying ? connectionState.attempt + 1 : 0,
          closeCode: null,
          detail: null,
        });
      },
      connected: () => {
        setConnectionState({
          status: "connected",
          attempt: 0,
          closeCode: null,
          detail: null,
        });
      },
      closed: (event) => {
        if (!isCloseLike(event)) {
          setConnectionState({
            status: "retrying",
            closeCode: null,
            detail: "The live connection closed unexpectedly.",
          });
          return;
        }

        setConnectionState({
          status: isFatalCloseCode(event.code) ? "disconnected" : "retrying",
          closeCode: event.code ?? null,
          detail: getCloseDetail(event),
        });
      },
      error: () => {
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
      },
    },
  });
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
