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
  createClient,
  type FormattedExecutionResult,
  type Sink,
} from "graphql-ws";
import type { RelayObservable } from "relay-runtime/lib/network/RelayObservable";

// These two always come from import.meta.env
const HTTP_ENDPOINT = import.meta.env.VITE_GRAPHQL_HTTP!;
const WS_PATH = import.meta.env.VITE_GRAPHQL_WS!;

// In dev, use exactly VITE_GRAPHQL_WS.
// In prod, build from window.location.
const WS_ENDPOINT = import.meta.env.DEV
  ? WS_PATH
  : `${window.location.protocol === "https:" ? "wss" : "ws"}://` +
    window.location.host +
    WS_PATH;

const wsClient = createClient({
  url: WS_ENDPOINT,
});

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
