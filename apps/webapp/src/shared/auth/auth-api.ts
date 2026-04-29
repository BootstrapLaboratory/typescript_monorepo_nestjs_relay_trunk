import { HTTP_ENDPOINT } from "../graphql/endpoints";
import {
  AuthApiError,
  createAuthApiErrorFromGraphqlErrors,
  hasAuthRequiredGraphqlErrors,
} from "./auth-errors";
import {
  getAuthRequestCredentials,
  refreshTokenTransport,
} from "./refresh-token-transport";
import {
  clearAuthSession,
  setAuthSessionFromPayload,
  type AuthPayload,
  type AuthSession,
} from "./session";

type GraphqlResponse<TData> = {
  data?: TData | null;
  errors?: unknown[];
};

type AuthMutationData = {
  refresh?: AuthPayload | null;
};

type LogoutData = {
  logout?: boolean | null;
};

const AUTH_PAYLOAD_FIELDS = `
  accessToken
  accessTokenExpiresAt
  refreshToken
  refreshTokenExpiresAt
  principal {
    userId
    subject
    provider
    roles
    permissions
  }
`;

const REFRESH_MUTATION = `
  mutation WebappRefresh($input: RefreshInput) {
    refresh(input: $input) {
      ${AUTH_PAYLOAD_FIELDS}
    }
  }
`;

const LOGOUT_MUTATION = `
  mutation WebappLogout($input: RefreshInput) {
    logout(input: $input)
  }
`;

let refreshPromise: Promise<AuthSession | null> | null = null;

async function requestGraphql<TData>(
  query: string,
  variables: Record<string, unknown>,
): Promise<TData> {
  const response = await fetch(HTTP_ENDPOINT, {
    method: "POST",
    credentials: getAuthRequestCredentials(),
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new AuthApiError("The auth request failed.");
  }

  const payload = (await response.json()) as GraphqlResponse<TData>;
  if (payload.errors?.length) {
    throw createAuthApiErrorFromGraphqlErrors(payload.errors);
  }

  if (!payload.data) {
    throw new AuthApiError("The auth request returned no data.");
  }

  return payload.data;
}

export async function refreshStoredAuthSession(): Promise<AuthSession | null> {
  refreshPromise ??= requestGraphql<AuthMutationData>(REFRESH_MUTATION, {
    input: refreshTokenTransport.createRefreshInput(),
  })
    .then((data) => {
      if (!data.refresh) {
        throw new AuthApiError("The refresh request returned no session.");
      }

      return setAuthSessionFromPayload(data.refresh);
    })
    .catch((error: unknown) => {
      if (
        error instanceof AuthApiError ||
        hasAuthRequiredGraphqlErrors({ errors: [error] })
      ) {
        clearAuthSession();
        return null;
      }

      clearAuthSession();
      return null;
    })
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
}

export async function logoutCurrentSession(): Promise<void> {
  const input = refreshTokenTransport.createLogoutInput();

  clearAuthSession();

  try {
    await requestGraphql<LogoutData>(LOGOUT_MUTATION, {
      input,
    });
  } catch {
    // Local state is already anonymous. A stale or missing refresh cookie should
    // not block the user from leaving the session in this browser.
  }
}
