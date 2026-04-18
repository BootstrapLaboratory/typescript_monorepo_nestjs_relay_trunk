import { StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./components/App.tsx";
import { RelayEnvironmentProvider } from "react-relay";
import {
  Environment,
  Network,
  type FetchFunction,
  Observable,
  type RequestParameters,
  type Variables,
  type GraphQLResponse,
  type Disposable,
} from "relay-runtime";
import {
  type FormattedExecutionResult,
  type Sink,
} from "graphql-ws";
import type { RelayObservable } from "relay-runtime/lib/network/RelayObservable";
import { createRealtimeGraphqlWsClient } from "./realtime-connection";

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

const HTTP_ENDPOINT = resolveHttpEndpoint(HTTP_CONFIG);
const WS_ENDPOINT = resolveWsEndpoint(WS_CONFIG);

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

const environment = new Environment({
  network: Network.create(fetchGraphQL, setupSubscription),
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RelayEnvironmentProvider environment={environment}>
      <Suspense fallback="Loading...">
        <App />
      </Suspense>
    </RelayEnvironmentProvider>
  </StrictMode>,
);
