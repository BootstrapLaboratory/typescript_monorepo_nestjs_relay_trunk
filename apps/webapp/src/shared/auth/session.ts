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

export type AuthSessionHint = {
  kind: "authenticated";
  updatedAt: number;
};

export type AuthState =
  | { status: "unknown"; sessionHint: AuthSessionHint | null }
  | { status: "anonymous" }
  | { status: "authenticated"; session: AuthSession };

const SESSION_HINT_STORAGE_KEY = "webapp:auth-session-hint";
const listeners = new Set<() => void>();

let authState: AuthState = {
  status: "unknown",
  sessionHint: readStoredAuthSessionHint(),
};

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

function isAuthSessionHint(value: unknown): value is AuthSessionHint {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const hint = value as AuthSessionHint;
  return (
    hint.kind === "authenticated" &&
    typeof hint.updatedAt === "number"
  );
}

function readStoredAuthSessionHint(): AuthSessionHint | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const rawValue = window.localStorage.getItem(SESSION_HINT_STORAGE_KEY);
    if (!rawValue) {
      return null;
    }

    const parsedValue: unknown = JSON.parse(rawValue);
    return isAuthSessionHint(parsedValue) ? parsedValue : null;
  } catch {
    return null;
  }
}

function writeStoredAuthSessionHint(): void {
  if (typeof window === "undefined") {
    return;
  }

  const hint: AuthSessionHint = {
    kind: "authenticated",
    updatedAt: Date.now(),
  };

  try {
    window.localStorage.setItem(SESSION_HINT_STORAGE_KEY, JSON.stringify(hint));
  } catch {
    // Ignore storage failures; the in-memory auth state still updates.
  }
}

function clearStoredAuthSessionHint(): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.removeItem(SESSION_HINT_STORAGE_KEY);
  } catch {
    // Ignore storage failures; the in-memory auth state still updates.
  }
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

export function shouldShowAuthenticatedNavigation(authState: AuthState): boolean {
  return (
    authState.status === "authenticated" ||
    (authState.status === "unknown" && authState.sessionHint !== null)
  );
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

  writeStoredAuthSessionHint();
  setAuthState({ status: "authenticated", session });
  return session;
}

export function clearAuthSession(): void {
  refreshTokenTransport.clear();
  clearStoredAuthSessionHint();
  setAuthState({ status: "anonymous" });
}

export function useAuthState(): AuthState {
  return useSyncExternalStore(subscribeAuthState, getAuthState, getAuthState);
}

export { subscribeAuthState };
