import type { AnyRouteWithContext } from "@tanstack/react-router";
import type { Environment } from "relay-runtime";

export type AppRouterContext = {
  relayEnvironment: Environment;
};

export type AppRouteParent = AnyRouteWithContext<AppRouterContext>;
