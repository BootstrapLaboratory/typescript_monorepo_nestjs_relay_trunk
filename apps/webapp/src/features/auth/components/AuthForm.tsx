import { useState } from "react";
import { useMutation } from "react-relay";
import {
  AuthApiError,
  createAuthApiErrorFromGraphqlErrors,
} from "../../../shared/auth/auth-errors";
import {
  setAuthSessionFromPayload,
  type AuthPayload,
} from "../../../shared/auth/session";
import type { AuthMode } from "../auth-mode";
import type { LoginMutation } from "../relay/__generated__/LoginMutation.graphql";
import type { RegisterMutation } from "../relay/__generated__/RegisterMutation.graphql";
import { LoginMutationNode } from "../relay/Login.mutation";
import { RegisterMutationNode } from "../relay/Register.mutation";
import { AuthFormView } from "./AuthFormView";

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

  async function handleSubmit() {
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
    <AuthFormView
      mode={mode}
      email={email}
      displayName={displayName}
      password={password}
      isSubmitting={isSubmitting}
      submitError={error}
      onEmailChange={setEmail}
      onDisplayNameChange={setDisplayName}
      onPasswordChange={setPassword}
      onSubmit={() => void handleSubmit()}
    />
  );
}
