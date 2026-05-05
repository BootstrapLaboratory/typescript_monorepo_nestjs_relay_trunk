import { createRoute } from "@tanstack/react-router";
import type { AppRouteParent } from "../../../app/router-context";
import { parseAuthMode } from "../auth-mode";
import { AuthRouteComponent } from "./AuthRouteComponent";

export function createAuthRoute(parentRoute: AppRouteParent) {
  return createRoute({
    getParentRoute: () => parentRoute,
    path: "/auth",
    validateSearch: (search: Record<string, unknown>) => ({
      mode: parseAuthMode(search.mode),
    }),
    component: AuthRouteComponent,
  });
}
