import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "../ui/Button";
import { Surface } from "../ui/Surface";
import * as statusStyles from "../ui/status.css";

type RouteErrorBoundaryProps = {
  children: ReactNode;
  pathname: string;
};

type RouteErrorBoundaryState = {
  error: Error | null;
};

export class RouteErrorBoundary extends Component<
  RouteErrorBoundaryProps,
  RouteErrorBoundaryState
> {
  state: RouteErrorBoundaryState = {
    error: null,
  };

  static getDerivedStateFromError(error: Error): RouteErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Route rendering failed.", error, errorInfo);
  }

  componentDidUpdate(prevProps: RouteErrorBoundaryProps) {
    if (prevProps.pathname !== this.props.pathname && this.state.error) {
      this.setState({ error: null });
    }
  }

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    return (
      <Surface tone="muted" className={statusStyles.statusPanel} role="alert">
        <div>
          <p className={statusStyles.eyebrow}>Route load failed</p>
          <h1 className={statusStyles.statusTitle}>
            Could not finish loading this page.
          </h1>
        </div>
        <p className={statusStyles.statusText}>
          The application could not load the assets for{" "}
          <code>{this.props.pathname}</code>. A fresh reload usually resolves
          this after a deployment.
        </p>
        <div>
          <Button variant="secondary" onClick={() => window.location.reload()}>
            Reload page
          </Button>
        </div>
      </Surface>
    );
  }
}
