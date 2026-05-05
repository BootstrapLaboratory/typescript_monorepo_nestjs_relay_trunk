import { Environment } from "relay-runtime";
import { createWebappRelayEnvironment } from "@omgjs/labkit-webapp-graphql-relay";
import { getAccessToken, subscribeAuthState } from "../auth/session";
import { hasAuthRequiredGraphqlErrors } from "../auth/auth-errors";
import { refreshStoredAuthSession } from "../auth/auth-api";
import { getAuthRequestCredentials } from "../auth/refresh-token-transport";
import { HTTP_ENDPOINT, WS_ENDPOINT } from "../graphql/endpoints";
import { createRealtimeGraphqlWsClient } from "../realtime/realtime-connection";

export function createRelayEnvironment(): Environment {
  return createWebappRelayEnvironment({
    httpEndpoint: HTTP_ENDPOINT,
    wsEndpoint: WS_ENDPOINT,
    auth: {
      getAccessToken,
      subscribeAuthState,
      refreshStoredAuthSession,
      getAuthRequestCredentials,
      hasAuthRequiredGraphqlErrors,
    },
    realtime: {
      createRealtimeGraphqlWsClient,
    },
  });
}
