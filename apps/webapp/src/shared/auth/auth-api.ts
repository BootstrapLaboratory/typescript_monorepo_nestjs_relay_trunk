import { HTTP_ENDPOINT } from "../graphql/endpoints";
import { createWebappAuthGraphqlApi } from "@omgjs/labkit-webapp-auth";
import { refreshTokenTransport } from "./refresh-token-transport";
import { clearAuthSession, setAuthSessionFromPayload } from "./session";

const authApi = createWebappAuthGraphqlApi({
  graphqlEndpoint: HTTP_ENDPOINT,
  refreshTokenTransport,
  setAuthSessionFromPayload,
  clearAuthSession,
});

export const refreshStoredAuthSession = authApi.refreshStoredAuthSession;
export const logoutCurrentSession = authApi.logoutCurrentSession;
