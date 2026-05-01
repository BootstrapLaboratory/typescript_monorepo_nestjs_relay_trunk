import type {
  CloudRunProviderDeps,
  ResolvedSyncCloudRunRuntimeSecretsInput,
  SyncCloudRunRuntimeSecretsInput,
  SyncCloudRunRuntimeSecretsOutput,
} from "./types.js";

export const CLOUD_RUN_RUNTIME_SECRET_NAMES = [
  "DATABASE_URL",
  "DATABASE_URL_DIRECT",
  "REDIS_URL",
] as const;

export const CLOUD_RUN_SERVICE_RUNTIME_SECRET_NAMES = [
  "DATABASE_URL",
  "REDIS_URL",
] as const;

export async function syncCloudRunRuntimeSecrets(
  input: SyncCloudRunRuntimeSecretsInput,
  deps: Pick<CloudRunProviderDeps, "secretManager">,
): Promise<SyncCloudRunRuntimeSecretsOutput> {
  const resolved = resolveSyncCloudRunRuntimeSecretsInput(input);

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
    CLOUD_RUN_RUNTIME_SECRETS_SYNCED: "true",
  };
}

export function resolveSyncCloudRunRuntimeSecretsInput(
  input: SyncCloudRunRuntimeSecretsInput,
): ResolvedSyncCloudRunRuntimeSecretsInput {
  return {
    DATABASE_URL: input.DATABASE_URL,
    DATABASE_URL_DIRECT: input.DATABASE_URL_DIRECT,
    DEPLOYER_SERVICE_ACCOUNT_EMAIL:
      input.GCP_SERVICE_ACCOUNT ??
      input.DEPLOYER_SERVICE_ACCOUNT_EMAIL ??
      serviceAccountEmail({
        accountId: input.DEPLOYER_SERVICE_ACCOUNT_ID ?? "github-actions-deployer",
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
}

function serviceAccountEmail(input: {
  accountId: string;
  projectId: string;
}): string {
  return `${input.accountId}@${input.projectId}.iam.gserviceaccount.com`;
}
