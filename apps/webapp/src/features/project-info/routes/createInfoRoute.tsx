import { createRoute } from "@tanstack/react-router";
import { RouteErrorComponent } from "../../../app/RouteErrorComponent";
import type { AppRouteParent } from "../../../app/router-context";
import { InfoRouteComponent } from "./InfoRouteComponent";

export function createInfoRoute(parentRoute: AppRouteParent) {
  return createRoute({
    getParentRoute: () => parentRoute,
    path: "/info",
    component: InfoRouteComponent,
    errorComponent: (props) => (
      <RouteErrorComponent {...props} pathname="/info" />
    ),
  });
}
