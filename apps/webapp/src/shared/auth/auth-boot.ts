import { getAuthState } from "./session";
import { refreshStoredAuthSession } from "./auth-api";

let bootstrapPromise: Promise<void> | null = null;

export function bootstrapAuthSession(): Promise<void> {
  if (getAuthState().status !== "unknown") {
    return Promise.resolve();
  }

  bootstrapPromise ??= refreshStoredAuthSession()
    .then(() => {})
    .finally(() => {
      bootstrapPromise = null;
    });

  return bootstrapPromise;
}

