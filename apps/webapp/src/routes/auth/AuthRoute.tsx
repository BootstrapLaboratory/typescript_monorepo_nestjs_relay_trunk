import { useEffect } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useAuthState } from "../../shared/auth/session";
import { AuthPage } from "../../features/auth/pages/AuthPage";
import type { AuthMode } from "../../features/auth/auth-mode";
import { PendingState } from "../../ui/StatusState";

export function AuthRoute() {
  const authState = useAuthState();
  const navigate = useNavigate({ from: "/auth" });
  const search = useSearch({ from: "/auth" });

  useEffect(() => {
    if (authState.status === "authenticated") {
      void navigate({ to: "/", replace: true });
    }
  }, [authState.status, navigate]);

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
      onModeChange={(mode: AuthMode) =>
        void navigate({
          to: "/auth",
          search: { mode },
          replace: true,
        })
      }
      onAuthenticated={() => void navigate({ to: "/", replace: true })}
    />
  );
}
