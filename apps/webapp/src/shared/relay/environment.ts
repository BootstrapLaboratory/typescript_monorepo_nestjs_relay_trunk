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
import { HTTP_ENDPOINT, WS_ENDPOINT } from "../graphql/endpoints";
import { createRealtimeGraphqlWsClient } from "../realtime/realtime-connection";

const wsClient = createRealtimeGraphqlWsClient(WS_ENDPOINT);

const fetchGraphQL: FetchFunction = async (request, variables) => {
  const resp = await fetch(HTTP_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: request.text, variables }),
  });
  if (!resp.ok) {
    throw new Error("Response failed.");
  }
  return await resp.json();
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
