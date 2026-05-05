import { createWebappAuthSessionBootstrap } from "@omgjs/labkit-webapp-auth";
import { getAuthState } from "./session";
import { refreshStoredAuthSession } from "./auth-api";

export const bootstrapAuthSession = createWebappAuthSessionBootstrap({
  getAuthState,
  refreshStoredAuthSession,
});
