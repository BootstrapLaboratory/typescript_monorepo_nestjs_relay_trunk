import { createRoute } from "@tanstack/react-router";
import { loadRouteQuery } from "@omgjs/labkit-webapp-graphql-relay";
import type { ReactNode } from "react";
import type { PreloadedQuery } from "react-relay";
import type {
  FetchPolicy,
  GraphQLTaggedNode,
  OperationType,
  VariablesOf,
} from "relay-runtime";
import { RouteErrorComponent } from "../RouteErrorComponent";
import type { AppRouteParent } from "../router-context";

type RelayRouteQueryDescriptor<TQuery extends OperationType> = {
  readonly document: GraphQLTaggedNode;
  readonly fetchPolicy?: FetchPolicy | null;
  readonly variables: VariablesOf<TQuery>;
};

type CreateRelayQueryRouteOptions<
  TPath extends string,
  TQuery extends OperationType,
> = RelayRouteQueryDescriptor<TQuery> & {
  gcTime?: number;
  parentRoute: AppRouteParent;
  path: TPath;
  render(queryRef: PreloadedQuery<TQuery>): ReactNode;
};

type RelayQueryRouteLoaderData<TQuery extends OperationType> = {
  queryRef: PreloadedQuery<TQuery>;
};

export function createRelayQueryRoute<
  const TPath extends string,
  TQuery extends OperationType,
>(options: CreateRelayQueryRouteOptions<TPath, TQuery>) {
  const RelayQueryRouteComponent = () => {
    const { queryRef } =
      route.useLoaderData() as RelayQueryRouteLoaderData<TQuery>;

    return options.render(queryRef);
  };

  const route = createRoute({
    getParentRoute: () => options.parentRoute,
    path: options.path,
    component: RelayQueryRouteComponent,
    errorComponent: (props) => (
      <RouteErrorComponent {...props} pathname={options.path} />
    ),
    gcTime: options.gcTime,
    loader: ({ abortController, context }) => ({
      queryRef: loadRouteQuery<TQuery>({
        abortSignal: abortController.signal,
        environment: context.relayEnvironment,
        fetchPolicy: options.fetchPolicy,
        query: options.document,
        variables: options.variables,
      }),
    }),
  });

  return route;
}
