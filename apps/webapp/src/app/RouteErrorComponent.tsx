import { useEffect } from "react";
import type { ErrorComponentProps } from "@tanstack/react-router";
import { Button } from "../ui/Button";
import { Surface } from "../ui/Surface";
import * as statusStyles from "../ui/status.css";

type RouteErrorComponentProps = ErrorComponentProps & {
  pathname?: string;
};

export function RouteErrorComponent({
  error,
  pathname = "this route",
  reset,
}: RouteErrorComponentProps) {
  useEffect(() => {
    console.error("Route rendering failed.", error);
  }, [error]);

  return (
    <Surface tone="muted" className={statusStyles.statusPanel} role="alert">
      <div>
        <p className={statusStyles.eyebrow}>Route load failed</p>
        <h1 className={statusStyles.statusTitle}>
          Could not finish loading this page.
        </h1>
      </div>
      <p className={statusStyles.statusText}>
        The application could not load the assets for <code>{pathname}</code>. A
        fresh reload usually resolves this after a deployment.
      </p>
      <div>
        {typeof reset === "function" ? (
          <Button variant="secondary" onClick={reset}>
            Try again
          </Button>
        ) : (
          <Button variant="secondary" onClick={() => window.location.reload()}>
            Reload page
          </Button>
        )}
      </div>
    </Surface>
  );
}
