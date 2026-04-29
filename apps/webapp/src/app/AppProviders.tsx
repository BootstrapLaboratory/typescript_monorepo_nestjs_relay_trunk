import { RouterProvider } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { RelayEnvironmentProvider } from "react-relay";
import { createRelayEnvironment } from "../shared/relay/environment";
import { applyThemeClass, useThemeName } from "../shared/theme/theme-store";
import { createAppRouter } from "./router";

export function AppProviders() {
  const themeName = useThemeName();
  const environment = useMemo(() => createRelayEnvironment(), []);
  const router = useMemo(() => createAppRouter(environment), [environment]);

  useEffect(() => {
    applyThemeClass(themeName);
  }, [themeName]);

  return (
    <RelayEnvironmentProvider environment={environment}>
      <RouterProvider router={router} />
    </RelayEnvironmentProvider>
  );
}
