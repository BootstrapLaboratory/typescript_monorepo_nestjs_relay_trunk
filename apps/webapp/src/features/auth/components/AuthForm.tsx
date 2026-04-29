import { type FormEvent, useState } from "react";
import { useMutation } from "react-relay";
import {
  AuthApiError,
  createAuthApiErrorFromGraphqlErrors,
} from "../../../shared/auth/auth-errors";
import {
  setAuthSessionFromPayload,
  type AuthPayload,
} from "../../../shared/auth/session";
import { Button } from "../../../ui/Button";
import { TextField } from "../../../ui/TextField";
import type { AuthMode } from "../auth-mode";
import type { LoginMutation } from "../relay/__generated__/LoginMutation.graphql";
import type { RegisterMutation } from "../relay/__generated__/RegisterMutation.graphql";
import { LoginMutationNode } from "../relay/Login.mutation";
import { RegisterMutationNode } from "../relay/Register.mutation";
import * as styles from "./AuthForm.css";

type AuthFormProps = {
  mode: AuthMode;
  onAuthenticated: () => void;
};

type LoginInput = LoginMutation["variables"]["input"];
type RegisterInput = RegisterMutation["variables"]["input"];

function getSubmitErrorMessage(error: unknown): string {
  return error instanceof AuthApiError
    ? error.message
    : "Authentication failed.";
}

export function AuthForm({ mode, onAuthenticated }: AuthFormProps) {
  const [commitLogin, isLoginPending] =
    useMutation<LoginMutation>(LoginMutationNode);
  const [commitRegister, isRegisterPending] =
    useMutation<RegisterMutation>(RegisterMutationNode);
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const isSubmitting = isLoginPending || isRegisterPending;
  const isRegisterMode = mode === "register";

  function submitLogin(input: LoginInput): Promise<AuthPayload> {
    return new Promise((resolve, reject) => {
      commitLogin({
        variables: { input },
        onCompleted: (response, errors) => {
          if (errors?.length) {
            reject(createAuthApiErrorFromGraphqlErrors(errors));
            return;
          }

          resolve(response.login);
        },
        onError: reject,
      });
    });
  }

  function submitRegister(input: RegisterInput): Promise<AuthPayload> {
    return new Promise((resolve, reject) => {
      commitRegister({
        variables: { input },
        onCompleted: (response, errors) => {
          if (errors?.length) {
            reject(createAuthApiErrorFromGraphqlErrors(errors));
            return;
          }

          resolve(response.register);
        },
        onError: reject,
      });
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const trimmedEmail = email.trim();
    const trimmedDisplayName = displayName.trim();

    try {
      const payload = isRegisterMode
        ? await submitRegister({
            email: trimmedEmail,
            password,
            displayName: trimmedDisplayName || null,
          })
        : await submitLogin({
            email: trimmedEmail,
            password,
          });

      setAuthSessionFromPayload(payload);
      onAuthenticated();
    } catch (submitError) {
      setError(getSubmitErrorMessage(submitError));
    }
  }

  return (
    <form
      aria-busy={isSubmitting}
      className={styles.form}
      onSubmit={(event) => void handleSubmit(event)}
    >
      {error ? (
        <p className={styles.error} role="alert">
          {error}
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
          onChange={(event) => setEmail(event.target.value)}
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
            onChange={(event) => setDisplayName(event.target.value)}
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
          onChange={(event) => setPassword(event.target.value)}
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
