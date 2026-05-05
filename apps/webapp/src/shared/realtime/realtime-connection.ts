import { useSyncExternalStore } from "react";
import type { Client } from "graphql-ws";
import {
  createWebappRealtimeConnection,
  parseRealtimeReconnectWatchdogMs,
  type GraphqlWsConnectionParamsFactory,
  type GraphqlWsConnectionState,
} from "@omgjs/labkit-webapp-realtime";

export {
  getRealtimeConnectionMessage,
  type GraphqlWsConnectionState,
  type GraphqlWsConnectionStatus,
} from "@omgjs/labkit-webapp-realtime";

const realtimeConnection = createWebappRealtimeConnection({
  logReconnects: import.meta.env.VITE_GRAPHQL_LOG_RECONNECTS === "true",
  reconnectWatchdogMs: parseRealtimeReconnectWatchdogMs(
    import.meta.env.VITE_GRAPHQL_RECONNECT_WATCHDOG_MS,
  ),
});

export function createRealtimeGraphqlWsClient(
  url: string,
  connectionParams?: GraphqlWsConnectionParamsFactory,
): Client {
  return realtimeConnection.createRealtimeGraphqlWsClient(
    url,
    connectionParams,
  );
}

export const subscribeToRealtimeConnectionState =
  realtimeConnection.subscribeToRealtimeConnectionState;
export const getRealtimeConnectionState =
  realtimeConnection.getRealtimeConnectionState;

export function useRealtimeConnectionState(): GraphqlWsConnectionState {
  return useSyncExternalStore(
    subscribeToRealtimeConnectionState,
    getRealtimeConnectionState,
  );
}
