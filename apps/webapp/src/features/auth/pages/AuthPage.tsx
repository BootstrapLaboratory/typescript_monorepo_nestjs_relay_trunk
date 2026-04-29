import { Button } from "../../../ui/Button";
import { Surface } from "../../../ui/Surface";
import { AuthForm } from "../components/AuthForm";
import type { AuthMode } from "../auth-mode";
import * as styles from "./AuthPage.css";

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
  const isRegisterMode = mode === "register";

  return (
    <section className={styles.page}>
      <Surface tone="raised" className={styles.panel}>
        <div className={styles.modeSwitch} aria-label="Authentication mode">
          <Button
            type="button"
            variant={mode === "login" ? "primary" : "secondary"}
            onClick={() => onModeChange("login")}
          >
            Login
          </Button>
          <Button
            type="button"
            variant={isRegisterMode ? "primary" : "secondary"}
            onClick={() => onModeChange("register")}
          >
            Register
          </Button>
        </div>
        <header className={styles.header}>
          <h1 className={styles.title}>
            {isRegisterMode ? "Create account" : "Login"}
          </h1>
          <p className={styles.description}>
            {isRegisterMode
              ? "Create a local account with an email and password."
              : "Use your email and password to continue."}
          </p>
        </header>
        <AuthForm mode={mode} onAuthenticated={onAuthenticated} />
      </Surface>
    </section>
  );
}

