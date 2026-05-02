export const AUTH_MODES = ["login", "register"] as const;

export type AuthMode = (typeof AUTH_MODES)[number];

export function parseAuthMode(value: unknown): AuthMode {
  return value === "register" ? "register" : "login";
}
