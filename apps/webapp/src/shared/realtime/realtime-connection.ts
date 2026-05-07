import { useSyncExternalStore } from "react";
import {
  DefaultWebappRealtimeConnection,
  parseRealtimeReconnectWatchdogMs,
  type GraphqlWsConnectionState,
} from "@omgjs/labkit-webapp-realtime";
import { createRelayGraphqlWsConnectionParams } from "@omgjs/labkit-webapp-graphql-relay";
import { getAccessToken } from "../auth/session";
import { WS_ENDPOINT } from "../graphql/endpoints";

export {
  getRealtimeConnectionMessage,
  type GraphqlWsConnectionState,
  type GraphqlWsConnectionStatus,
} from "@omgjs/labkit-webapp-realtime";

export const realtimeConnection = new DefaultWebappRealtimeConnection({
  wsEndpoint: WS_ENDPOINT,
  connectionParams: () => createRelayGraphqlWsConnectionParams(getAccessToken),
  logReconnects: import.meta.env.VITE_GRAPHQL_LOG_RECONNECTS === "true",
  reconnectWatchdogMs: parseRealtimeReconnectWatchdogMs(
    import.meta.env.VITE_GRAPHQL_RECONNECT_WATCHDOG_MS,
  ),
});

export function subscribeToRealtimeConnectionState(
  listener: (state: GraphqlWsConnectionState) => void,
) {
  return realtimeConnection.subscribeToConnectionState(listener);
}

export function getRealtimeConnectionState(): GraphqlWsConnectionState {
  return realtimeConnection.getConnectionState();
}

export function useRealtimeConnectionState(): GraphqlWsConnectionState {
  return useSyncExternalStore(
    subscribeToRealtimeConnectionState,
    getRealtimeConnectionState,
  );
}
