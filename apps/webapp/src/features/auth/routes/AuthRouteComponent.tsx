import { useNavigate, useSearch } from "@tanstack/react-router";
import { useCallback, useEffect } from "react";
import { useAuthState } from "../../../shared/auth/session";
import { PendingState } from "../../../ui/StatusState";
import type { AuthMode } from "../auth-mode";
import { AuthPage } from "../pages/AuthPage";

export function AuthRouteComponent() {
  const navigate = useNavigate({ from: "/auth" });
  const search = useSearch({ from: "/auth" });
  const authState = useAuthState();

  const handleAuthenticated = useCallback(() => {
    void navigate({ to: "/", replace: true });
  }, [navigate]);

  const handleModeChange = useCallback(
    (mode: AuthMode) => {
      void navigate({
        to: "/auth",
        search: { mode },
        replace: true,
      });
    },
    [navigate],
  );

  useEffect(() => {
    if (authState.status === "authenticated") {
      handleAuthenticated();
    }
  }, [authState.status, handleAuthenticated]);

  if (authState.status === "unknown") {
    return (
      <PendingState
        eyebrow="Session"
        title="Checking session"
        message="The page is ready while the current browser session is restored."
      />
    );
  }

  if (authState.status === "authenticated") {
    return null;
  }

  return (
    <AuthPage
      mode={search.mode}
      onModeChange={handleModeChange}
      onAuthenticated={handleAuthenticated}
    />
  );
}
