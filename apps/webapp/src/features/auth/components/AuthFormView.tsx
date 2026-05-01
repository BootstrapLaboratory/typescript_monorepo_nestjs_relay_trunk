import { type FormEvent } from "react";
import { Button } from "../../../ui/Button";
import { TextField } from "../../../ui/TextField";
import type { AuthMode } from "../auth-mode";
import * as styles from "./AuthForm.css";

export type AuthFormViewProps = {
  mode: AuthMode;
  email: string;
  displayName: string;
  password: string;
  isSubmitting: boolean;
  submitError: string | null;
  onEmailChange: (email: string) => void;
  onDisplayNameChange: (displayName: string) => void;
  onPasswordChange: (password: string) => void;
  onSubmit: () => void;
};

export function AuthFormView({
  mode,
  email,
  displayName,
  password,
  isSubmitting,
  submitError,
  onEmailChange,
  onDisplayNameChange,
  onPasswordChange,
  onSubmit,
}: AuthFormViewProps) {
  const isRegisterMode = mode === "register";

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit();
  }

  return (
    <form
      aria-busy={isSubmitting}
      className={styles.form}
      onSubmit={handleSubmit}
    >
      {submitError ? (
        <p className={styles.error} role="alert">
          {submitError}
        </p>
      ) : null}
      <label className={styles.field}>
        <span className={styles.label}>Email</span>
        <TextField
          autoComplete="email"
          inputMode="email"
          maxLength={320}
          required
          type="email"
          value={email}
          onChange={(event) => onEmailChange(event.target.value)}
        />
      </label>
      {isRegisterMode ? (
        <label className={styles.field}>
          <span className={styles.label}>
            Display name <span className={styles.optional}>optional</span>
          </span>
          <TextField
            autoComplete="name"
            maxLength={120}
            value={displayName}
            onChange={(event) => onDisplayNameChange(event.target.value)}
          />
        </label>
      ) : null}
      <label className={styles.field}>
        <span className={styles.label}>Password</span>
        <TextField
          autoComplete={isRegisterMode ? "new-password" : "current-password"}
          minLength={8}
          maxLength={256}
          required
          type="password"
          value={password}
          onChange={(event) => onPasswordChange(event.target.value)}
        />
      </label>
      <div className={styles.actions}>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting
            ? "Working..."
            : isRegisterMode
              ? "Create account"
              : "Login"}
        </Button>
      </div>
    </form>
  );
}
