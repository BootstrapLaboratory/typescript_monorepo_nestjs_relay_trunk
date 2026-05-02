export type GraphqlErrorLike = {
  message?: string;
  extensions?: {
    code?: string;
    statusCode?: number;
    originalError?: {
      code?: string;
      message?: string;
      statusCode?: number;
    };
  };
};

export class AuthApiError extends Error {
  readonly code: string | null;

  constructor(message: string, code: string | null = null) {
    super(message);
    this.name = "AuthApiError";
    this.code = code;
  }
}

function isGraphqlErrorLike(value: unknown): value is GraphqlErrorLike {
  return typeof value === "object" && value !== null;
}

export function getGraphqlErrorCode(error: unknown): string | null {
  if (!isGraphqlErrorLike(error)) {
    return null;
  }

  return (
    error.extensions?.originalError?.code ?? error.extensions?.code ?? null
  );
}

function getGraphqlErrorStatusCode(error: unknown): number | null {
  if (!isGraphqlErrorLike(error)) {
    return null;
  }

  return (
    error.extensions?.originalError?.statusCode ??
    error.extensions?.statusCode ??
    null
  );
}

export function getGraphqlErrorMessage(error: unknown): string {
  if (!isGraphqlErrorLike(error)) {
    return "The request failed.";
  }

  return (
    error.extensions?.originalError?.message ??
    error.message ??
    "The request failed."
  );
}

export function isAuthRequiredGraphqlError(error: unknown): boolean {
  const code = getGraphqlErrorCode(error);
  const statusCode = getGraphqlErrorStatusCode(error);
  const message = getGraphqlErrorMessage(error).toLowerCase();

  return (
    statusCode === 401 ||
    code === "AUTH_REQUIRED" ||
    code === "UNAUTHENTICATED" ||
    code === "UNAUTHORIZED" ||
    message.includes("authentication is required") ||
    message.includes("invalid access token")
  );
}

export function hasAuthRequiredGraphqlErrors(payload: unknown): boolean {
  if (
    typeof payload !== "object" ||
    payload === null ||
    !("errors" in payload)
  ) {
    return false;
  }

  const errors = (payload as { errors?: unknown }).errors;
  return Array.isArray(errors) && errors.some(isAuthRequiredGraphqlError);
}

export function createAuthApiErrorFromGraphqlErrors(
  errors: ReadonlyArray<unknown> | null | undefined,
): AuthApiError {
  const firstError = errors?.[0];

  return new AuthApiError(
    firstError ? getGraphqlErrorMessage(firstError) : "Authentication failed.",
    firstError ? getGraphqlErrorCode(firstError) : null,
  );
}
