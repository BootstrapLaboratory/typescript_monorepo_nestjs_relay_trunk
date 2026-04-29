const HTTP_CONFIG = import.meta.env.VITE_GRAPHQL_HTTP!;
const WS_CONFIG = import.meta.env.VITE_GRAPHQL_WS!;

function isAbsoluteUrl(value: string): boolean {
  return /^[a-z][a-z\d+\-.]*:\/\//i.test(value);
}

function resolveHttpEndpoint(endpoint: string): string {
  if (isAbsoluteUrl(endpoint)) {
    return endpoint;
  }

  if (import.meta.env.DEV) {
    return endpoint;
  }

  return new URL(endpoint, window.location.origin).toString();
}

function resolveWsEndpoint(endpoint: string): string {
  if (isAbsoluteUrl(endpoint)) {
    return endpoint;
  }

  if (import.meta.env.DEV) {
    return endpoint;
  }

  const wsOrigin = `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}`;
  return new URL(endpoint, wsOrigin).toString();
}

export const HTTP_ENDPOINT = resolveHttpEndpoint(HTTP_CONFIG);
export const WS_ENDPOINT = resolveWsEndpoint(WS_CONFIG);
