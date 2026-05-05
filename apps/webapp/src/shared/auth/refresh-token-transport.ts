import {
  cookieRefreshTokenTransport,
  getAuthRequestCredentials as getAuthRequestCredentialsForTransport,
} from "@omgjs/labkit-webapp-auth";

export const refreshTokenTransport = cookieRefreshTokenTransport;

export function getAuthRequestCredentials(): RequestCredentials {
  return getAuthRequestCredentialsForTransport(refreshTokenTransport);
}

export type {
  AuthRequestCredentials,
  RefreshInput,
  RefreshTokenTransportStrategy,
} from "@omgjs/labkit-webapp-auth";
