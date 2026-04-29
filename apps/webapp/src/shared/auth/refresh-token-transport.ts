import type { AuthPayload } from "./session";

export type RefreshInput = {
  refreshToken?: string | null;
};

export type RefreshTokenTransport = {
  readonly requestCredentials: RequestCredentials;
  createRefreshInput: () => RefreshInput | null;
  createLogoutInput: () => RefreshInput | null;
  handleAuthPayload: (payload: AuthPayload) => void;
  clear: () => void;
};

const cookieRefreshTokenTransport: RefreshTokenTransport = {
  requestCredentials: "include",
  createRefreshInput: () => null,
  createLogoutInput: () => null,
  handleAuthPayload: () => {},
  clear: () => {},
};

export const refreshTokenTransport = cookieRefreshTokenTransport;

export function getAuthRequestCredentials(): RequestCredentials {
  return refreshTokenTransport.requestCredentials;
}

