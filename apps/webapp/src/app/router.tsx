import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { loadQuery } from "react-relay";
import type { Environment } from "relay-runtime";
import type { ChatQuery } from "../features/chat/relay/__generated__/ChatQuery.graphql";
import { ChatPageQuery } from "../features/chat/relay/Chat.query";
import { AppShell } from "./AppShell";
import { ChatRouteAdapter } from "../routes/chat/ChatRouteAdapter";
import { InfoRoute } from "../routes/info/InfoRoute";
import { NotFoundRoute } from "../routes/not-found/NotFoundRoute";

type AppRouterContext = {
  relayEnvironment: Environment;
};

const rootRoute = createRootRouteWithContext<AppRouterContext>()({
  component: AppShell,
  notFoundComponent: NotFoundRoute,
});

const chatRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: ChatRouteAdapter,
  gcTime: 0,
  loader: ({ abortController, context }) => {
    const queryRef = loadQuery<ChatQuery>(
      context.relayEnvironment,
      ChatPageQuery,
      {},
      { fetchPolicy: "store-or-network" },
    );

    abortController.signal.addEventListener(
      "abort",
      () => {
        queryRef.dispose();
      },
      { once: true },
    );

    return { queryRef };
  },
});

const infoRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/info",
  component: InfoRoute,
});

const routeTree = rootRoute.addChildren([chatRoute, infoRoute]);

export function createAppRouter(relayEnvironment: Environment) {
  return createRouter({
    routeTree,
    context: {
      relayEnvironment,
    },
    defaultPreload: "intent",
  });
}

export type AppRouter = ReturnType<typeof createAppRouter>;

declare module "@tanstack/react-router" {
  interface Register {
    router: AppRouter;
  }
}
