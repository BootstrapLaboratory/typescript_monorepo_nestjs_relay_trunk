import { useSyncExternalStore } from "react";
import { refreshTokenTransport } from "./refresh-token-transport";

export type Principal = {
  userId: string;
  subject: string;
  provider: string;
  displayName?: string | null;
  roles: ReadonlyArray<string>;
  permissions: ReadonlyArray<string>;
};

export type AuthPayload = {
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken?: string | null;
  refreshTokenExpiresAt: string;
  principal: Principal;
};

export type AuthSession = {
  accessToken: string;
  accessTokenExpiresAt: number;
  refreshTokenExpiresAt: number;
  principal: Principal;
};

export type AuthState =
  | { status: "unknown" }
  | { status: "anonymous" }
  | { status: "authenticated"; session: AuthSession };

const listeners = new Set<() => void>();

let authState: AuthState = { status: "unknown" };

function emitAuthStateChange(): void {
  for (const listener of listeners) {
    listener();
  }
}

function subscribeAuthState(listener: () => void): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

function parseTimestamp(value: string): number {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : Date.now();
}

function setAuthState(nextState: AuthState): void {
  authState = nextState;
  emitAuthStateChange();
}

export function getAuthState(): AuthState {
  return authState;
}

export function getAuthSession(): AuthSession | null {
  return authState.status === "authenticated" ? authState.session : null;
}

export function getAccessToken(): string | null {
  return getAuthSession()?.accessToken ?? null;
}

export function getPrincipalDisplayName(principal: Principal): string {
  return principal.displayName?.trim() || principal.subject;
}

export function setAuthSessionFromPayload(payload: AuthPayload): AuthSession {
  refreshTokenTransport.handleAuthPayload(payload);

  const session: AuthSession = {
    accessToken: payload.accessToken,
    accessTokenExpiresAt: parseTimestamp(payload.accessTokenExpiresAt),
    refreshTokenExpiresAt: parseTimestamp(payload.refreshTokenExpiresAt),
    principal: {
      displayName: payload.principal.displayName ?? null,
      permissions: [...payload.principal.permissions],
      provider: payload.principal.provider,
      roles: [...payload.principal.roles],
      subject: payload.principal.subject,
      userId: payload.principal.userId,
    },
  };

  setAuthState({ status: "authenticated", session });
  return session;
}

export function clearAuthSession(): void {
  refreshTokenTransport.clear();
  setAuthState({ status: "anonymous" });
}

export function useAuthState(): AuthState {
  return useSyncExternalStore(subscribeAuthState, getAuthState, getAuthState);
}

export { subscribeAuthState };
