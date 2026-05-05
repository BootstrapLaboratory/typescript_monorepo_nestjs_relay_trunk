import { useSyncExternalStore } from "react";
import {
  createAuthSessionHintStorage,
  createWebappAuthSession,
  getPrincipalDisplayName,
  shouldShowAuthenticatedNavigation,
  type AuthPayload,
  type AuthSession,
  type AuthSessionHint,
  type AuthState,
  type Principal,
} from "@omgjs/labkit-webapp-auth";
import { refreshTokenTransport } from "./refresh-token-transport";

const authSession = createWebappAuthSession({
  refreshTokenTransport,
  sessionHintStorage: createAuthSessionHintStorage({
    storageKey: "webapp:auth-session-hint",
  }),
});

export const getAuthState = authSession.getAuthState;
export const getAuthSession = authSession.getAuthSession;
export const getAccessToken = authSession.getAccessToken;
export const setAuthSessionFromPayload = authSession.setAuthSessionFromPayload;
export const clearAuthSession = authSession.clearAuthSession;
export const subscribeAuthState = authSession.subscribeAuthState;

export function useAuthState(): AuthState {
  return useSyncExternalStore(subscribeAuthState, getAuthState, getAuthState);
}

export { getPrincipalDisplayName, shouldShowAuthenticatedNavigation };
export type { AuthPayload, AuthSession, AuthSessionHint, AuthState, Principal };
