import {
  createRootRouteWithContext,
  createRouter,
} from "@tanstack/react-router";
import type { Environment } from "relay-runtime";
import { AppShell } from "./AppShell";
import type { AppRouterContext } from "./router-context";
import { createAuthRoute } from "../features/auth/routes/createAuthRoute";
import { createChatRoute } from "../features/chat/routes/createChatRoute";
import { NotFoundPage } from "../features/navigation/pages/NotFoundPage";
import { createInfoRoute } from "../features/project-info/routes/createInfoRoute";

const rootRoute = createRootRouteWithContext<AppRouterContext>()({
  component: AppShell,
  notFoundComponent: NotFoundPage,
});

const routeTree = rootRoute.addChildren([
  createChatRoute(rootRoute),
  createInfoRoute(rootRoute),
  createAuthRoute(rootRoute),
]);

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
