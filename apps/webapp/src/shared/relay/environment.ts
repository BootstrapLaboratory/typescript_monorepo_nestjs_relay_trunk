import { DefaultWebappRelayRuntime } from "@omgjs/labkit-webapp-graphql-relay";
import { parseRealtimeReconnectWatchdogMs } from "@omgjs/labkit-webapp-realtime";
import {
  getAccessToken,
  getAuthSession,
  subscribeAuthState,
} from "../auth/session";
import { hasAuthRequiredGraphqlErrors } from "../auth/auth-errors";
import { refreshStoredAuthSession } from "../auth/auth-api";
import { getAuthRequestCredentials } from "../auth/refresh-token-transport";
import { HTTP_ENDPOINT, WS_ENDPOINT } from "../graphql/endpoints";

export const relayRuntime = new DefaultWebappRelayRuntime({
  httpEndpoint: HTTP_ENDPOINT,
  wsEndpoint: WS_ENDPOINT,
  auth: {
    getAccessToken,
    getAuthSession,
    subscribeAuthState,
    refreshStoredAuthSession,
    getAuthRequestCredentials,
    hasAuthRequiredGraphqlErrors,
  },
  realtimeOptions: {
    logReconnects: import.meta.env.VITE_GRAPHQL_LOG_RECONNECTS === "true",
    reconnectWatchdogMs: parseRealtimeReconnectWatchdogMs(
      import.meta.env.VITE_GRAPHQL_RECONNECT_WATCHDOG_MS,
    ),
  },
});

export const createRelayEnvironment = relayRuntime.getEnvironment;
