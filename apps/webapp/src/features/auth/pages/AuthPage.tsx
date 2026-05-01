import { AuthForm } from "../components/AuthForm";
import type { AuthMode } from "../auth-mode";
import { AuthPageView } from "./AuthPageView";

type AuthPageProps = {
  mode: AuthMode;
  onModeChange: (mode: AuthMode) => void;
  onAuthenticated: () => void;
};

export function AuthPage({
  mode,
  onAuthenticated,
  onModeChange,
}: AuthPageProps) {
  return (
    <AuthPageView
      mode={mode}
      onModeChange={onModeChange}
      form={<AuthForm mode={mode} onAuthenticated={onAuthenticated} />}
    />
  );
}
