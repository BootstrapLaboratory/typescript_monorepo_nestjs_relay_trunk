import { randomBytes } from "node:crypto";

import type {
  CloudRunProviderDeps,
  ResolvedSyncCloudRunRuntimeSecretsInput,
  SyncCloudRunRuntimeSecretsInput,
  SyncCloudRunRuntimeSecretsOutput,
} from "./types.js";

export const AUTH_ACCESS_TOKEN_SECRET_NAME = "AUTH_ACCESS_TOKEN_SECRET";
export const AUTH_ACCESS_TOKEN_SECRET_MIN_LENGTH = 32;

export const CLOUD_RUN_RUNTIME_SECRET_NAMES = [
  "DATABASE_URL",
  "DATABASE_URL_DIRECT",
  "REDIS_URL",
  AUTH_ACCESS_TOKEN_SECRET_NAME,
] as const;

export const CLOUD_RUN_SERVICE_RUNTIME_SECRET_NAMES = [
  "DATABASE_URL",
  "REDIS_URL",
  AUTH_ACCESS_TOKEN_SECRET_NAME,
] as const;

export async function syncCloudRunRuntimeSecrets(
  input: SyncCloudRunRuntimeSecretsInput,
  deps: Pick<CloudRunProviderDeps, "secretManager">,
): Promise<SyncCloudRunRuntimeSecretsOutput> {
  const resolved = resolveSyncCloudRunRuntimeSecretsInput(input);
  const authSecretStatus = await syncAuthAccessTokenSecret(resolved, deps);

  await deps.secretManager.upsertSecretVersion({
    projectId: resolved.PROJECT_ID,
    secretName: "DATABASE_URL",
    value: resolved.DATABASE_URL,
  });
  await deps.secretManager.upsertSecretVersion({
    projectId: resolved.PROJECT_ID,
    secretName: "DATABASE_URL_DIRECT",
    value: resolved.DATABASE_URL_DIRECT,
  });
  await deps.secretManager.upsertSecretVersion({
    projectId: resolved.PROJECT_ID,
    secretName: "REDIS_URL",
    value: resolved.REDIS_URL,
  });

  for (const secretName of CLOUD_RUN_RUNTIME_SECRET_NAMES) {
    await deps.secretManager.ensureSecretIamBinding({
      member: `serviceAccount:${resolved.DEPLOYER_SERVICE_ACCOUNT_EMAIL}`,
      projectId: resolved.PROJECT_ID,
      role: "roles/secretmanager.secretAccessor",
      secretName,
    });
  }

  for (const secretName of CLOUD_RUN_SERVICE_RUNTIME_SECRET_NAMES) {
    await deps.secretManager.ensureSecretIamBinding({
      member: `serviceAccount:${resolved.RUNTIME_SERVICE_ACCOUNT_EMAIL}`,
      projectId: resolved.PROJECT_ID,
      role: "roles/secretmanager.secretAccessor",
      secretName,
    });
  }

  return {
    AUTH_ACCESS_TOKEN_SECRET_STATUS: authSecretStatus,
    CLOUD_RUN_RUNTIME_SECRETS_SYNCED: "true",
  };
}

export function resolveSyncCloudRunRuntimeSecretsInput(
  input: SyncCloudRunRuntimeSecretsInput,
): ResolvedSyncCloudRunRuntimeSecretsInput {
  const resolved: ResolvedSyncCloudRunRuntimeSecretsInput = {
    AUTH_ACCESS_TOKEN_SECRET_ROTATE: parseBooleanFlag(
      input.AUTH_ACCESS_TOKEN_SECRET_ROTATE,
      "AUTH_ACCESS_TOKEN_SECRET_ROTATE",
    ),
    DATABASE_URL: input.DATABASE_URL,
    DATABASE_URL_DIRECT: input.DATABASE_URL_DIRECT,
    DEPLOYER_SERVICE_ACCOUNT_EMAIL:
      input.GCP_SERVICE_ACCOUNT ??
      input.DEPLOYER_SERVICE_ACCOUNT_EMAIL ??
      serviceAccountEmail({
        accountId:
          input.DEPLOYER_SERVICE_ACCOUNT_ID ?? "github-actions-deployer",
        projectId: input.PROJECT_ID,
      }),
    PROJECT_ID: input.PROJECT_ID,
    REDIS_URL: input.REDIS_URL,
    RUNTIME_SERVICE_ACCOUNT_EMAIL:
      input.CLOUD_RUN_RUNTIME_SERVICE_ACCOUNT ??
      input.RUNTIME_SERVICE_ACCOUNT_EMAIL ??
      serviceAccountEmail({
        accountId: input.RUNTIME_SERVICE_ACCOUNT_ID ?? "cloud-run-runtime",
        projectId: input.PROJECT_ID,
      }),
  };

  if (
    input.AUTH_ACCESS_TOKEN_SECRET !== undefined &&
    input.AUTH_ACCESS_TOKEN_SECRET !== ""
  ) {
    resolved.AUTH_ACCESS_TOKEN_SECRET = input.AUTH_ACCESS_TOKEN_SECRET;
  }

  return resolved;
}

async function syncAuthAccessTokenSecret(
  input: ResolvedSyncCloudRunRuntimeSecretsInput,
  deps: Pick<CloudRunProviderDeps, "secretManager">,
): Promise<"created" | "preserved" | "rotated"> {
  const exists = await deps.secretManager.secretExists({
    projectId: input.PROJECT_ID,
    secretName: AUTH_ACCESS_TOKEN_SECRET_NAME,
  });

  if (exists && !input.AUTH_ACCESS_TOKEN_SECRET_ROTATE) {
    return "preserved";
  }

  const value =
    input.AUTH_ACCESS_TOKEN_SECRET ?? generateAuthAccessTokenSecret();
  assertAuthAccessTokenSecret(value);

  await deps.secretManager.upsertSecretVersion({
    projectId: input.PROJECT_ID,
    secretName: AUTH_ACCESS_TOKEN_SECRET_NAME,
    value,
  });

  return exists ? "rotated" : "created";
}

function generateAuthAccessTokenSecret(): string {
  return randomBytes(48).toString("hex");
}

function assertAuthAccessTokenSecret(value: string): void {
  if (value.length < AUTH_ACCESS_TOKEN_SECRET_MIN_LENGTH) {
    throw new Error(
      "AUTH_ACCESS_TOKEN_SECRET must be configured with at least 32 characters.",
    );
  }
}

function parseBooleanFlag(value: boolean | string | undefined, name: string) {
  if (typeof value === "boolean") {
    return value;
  }

  if (value === undefined || value.trim() === "") {
    return false;
  }

  switch (value.trim().toLowerCase()) {
    case "1":
    case "true":
    case "yes":
    case "y":
    case "rotate":
      return true;
    case "0":
    case "false":
    case "no":
    case "n":
    case "preserve":
      return false;
    default:
      throw new Error(
        `${name} must be yes/no, true/false, 1/0, rotate, or preserve.`,
      );
  }
}

function serviceAccountEmail(input: {
  accountId: string;
  projectId: string;
}): string {
  return `${input.accountId}@${input.projectId}.iam.gserviceaccount.com`;
}
