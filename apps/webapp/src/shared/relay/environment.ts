import {
  Environment,
  Network,
  Observable,
  type Disposable,
  type FetchFunction,
  type GraphQLResponse,
  type RequestParameters,
  type Variables,
} from "relay-runtime";
import type { RelayObservable } from "relay-runtime/lib/network/RelayObservable";
import { type FormattedExecutionResult, type Sink } from "graphql-ws";
import { getAccessToken, subscribeAuthState } from "../auth/session";
import { hasAuthRequiredGraphqlErrors } from "../auth/auth-errors";
import { refreshStoredAuthSession } from "../auth/auth-api";
import { getAuthRequestCredentials } from "../auth/refresh-token-transport";
import { HTTP_ENDPOINT, WS_ENDPOINT } from "../graphql/endpoints";
import { createRealtimeGraphqlWsClient } from "../realtime/realtime-connection";

function createRealtimeConnectionParams(): Record<string, string> {
  const accessToken = getAccessToken();
  if (!accessToken) {
    return {};
  }

  return { authorization: `Bearer ${accessToken}` };
}

const wsClient = createRealtimeGraphqlWsClient(
  WS_ENDPOINT,
  createRealtimeConnectionParams,
);

const AUTH_OPERATION_NAMES = new Set([
  "LoginMutation",
  "RegisterMutation",
  "RefreshMutation",
  "LogoutMutation",
]);

let realtimeAccessToken = getAccessToken();

subscribeAuthState(() => {
  const nextAccessToken = getAccessToken();
  if (nextAccessToken === realtimeAccessToken) {
    return;
  }

  realtimeAccessToken = nextAccessToken;
  wsClient.terminate();
});

function createUnauthorizedResponse(): GraphQLResponse {
  return {
    data: null,
    errors: [
      {
        message: "Authentication is required.",
        extensions: {
          statusCode: 401,
        },
      },
    ],
  } as unknown as GraphQLResponse;
}

async function fetchGraphqlOnce(
  request: RequestParameters,
  variables: Variables,
): Promise<GraphQLResponse> {
  const accessToken = getAccessToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (accessToken) {
    headers.authorization = `Bearer ${accessToken}`;
  }

  const resp = await fetch(HTTP_ENDPOINT, {
    method: "POST",
    credentials: getAuthRequestCredentials(),
    headers,
    body: JSON.stringify({ query: request.text, variables }),
  });

  if (resp.status === 401) {
    return createUnauthorizedResponse();
  }

  if (!resp.ok) {
    throw new Error("Response failed.");
  }

  return await resp.json();
}

const fetchGraphQL: FetchFunction = async (request, variables) => {
  const response = await fetchGraphqlOnce(request, variables);
  if (
    AUTH_OPERATION_NAMES.has(request.name) ||
    !hasAuthRequiredGraphqlErrors(response)
  ) {
    return response;
  }

  const refreshedSession = await refreshStoredAuthSession();
  if (!refreshedSession) {
    return response;
  }

  return fetchGraphqlOnce(request, variables);
};

function setupSubscription(
  operation: RequestParameters,
  variables: Variables,
): RelayObservable<GraphQLResponse> | Disposable {
  return Observable.create((sink) =>
    wsClient.subscribe(
      {
        operationName: operation.name,
        query: operation.text || "",
        variables,
      },
      sink as Sink<
        FormattedExecutionResult<GraphQLResponse, Record<string, unknown>>
      >,
    ),
  );
}

export function createRelayEnvironment(): Environment {
  return new Environment({
    network: Network.create(fetchGraphQL, setupSubscription),
  });
}
