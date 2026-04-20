import { Component, type ErrorInfo, type ReactNode } from "react";

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
      <section className="route-error" role="alert">
        <p className="info-page__eyebrow">Route load failed</p>
        <h1>Could not finish loading this page.</h1>
        <p>
          The application could not load the assets for{" "}
          <code>{this.props.pathname}</code>. A fresh reload usually resolves
          this after a deployment.
        </p>
        <button type="button" onClick={() => window.location.reload()}>
          Reload page
        </button>
      </section>
    );
  }
}
