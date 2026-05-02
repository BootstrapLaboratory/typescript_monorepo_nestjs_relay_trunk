import type {
  BootstrapCloudRunInput,
  BootstrapCloudRunOutput,
  CloudRunProviderDeps,
  ResolvedBootstrapCloudRunInput,
} from "./types.js";

export const REQUIRED_BOOTSTRAP_SERVICES = [
  "artifactregistry.googleapis.com",
  "cloudresourcemanager.googleapis.com",
  "iam.googleapis.com",
  "iamcredentials.googleapis.com",
  "run.googleapis.com",
  "secretmanager.googleapis.com",
  "serviceusage.googleapis.com",
  "sts.googleapis.com",
] as const;

export async function bootstrapCloudRun(
  input: BootstrapCloudRunInput,
  deps: CloudRunProviderDeps,
): Promise<BootstrapCloudRunOutput> {
  const resolved = resolveBootstrapCloudRunInput(input);

  if (resolved.BILLING_ACCOUNT_ID !== undefined) {
    await deps.billing.linkProject({
      billingAccountId: resolved.BILLING_ACCOUNT_ID,
      projectId: resolved.PROJECT_ID,
    });
  }

  const projectNumber = await deps.projects.getProjectNumber(
    resolved.PROJECT_ID,
  );

  await deps.services.enableServices({
    projectId: resolved.PROJECT_ID,
    projectNumber,
    services: [...REQUIRED_BOOTSTRAP_SERVICES],
  });

  await deps.artifactRegistry.ensureDockerRepository({
    description: "Cloud Run backend images",
    projectId: resolved.PROJECT_ID,
    region: resolved.CLOUD_RUN_REGION,
    repository: resolved.ARTIFACT_REGISTRY_REPOSITORY,
  });

  const deployerServiceAccountEmail = serviceAccountEmail({
    accountId: resolved.DEPLOYER_SERVICE_ACCOUNT_ID,
    projectId: resolved.PROJECT_ID,
  });
  const runtimeServiceAccountEmail = serviceAccountEmail({
    accountId: resolved.RUNTIME_SERVICE_ACCOUNT_ID,
    projectId: resolved.PROJECT_ID,
  });

  await deps.iam.ensureServiceAccount({
    accountId: resolved.DEPLOYER_SERVICE_ACCOUNT_ID,
    displayName: "GitHub Actions deployer",
    projectId: resolved.PROJECT_ID,
  });
  await deps.iam.ensureServiceAccount({
    accountId: resolved.RUNTIME_SERVICE_ACCOUNT_ID,
    displayName: "Cloud Run runtime",
    projectId: resolved.PROJECT_ID,
  });

  const workloadIdentity = await deps.workloadIdentity.ensureGithubOidcProvider(
    {
      attributeCondition: `assertion.repository == '${resolved.GITHUB_REPOSITORY}'`,
      attributeMapping: {
        "attribute.actor": "assertion.actor",
        "attribute.ref": "assertion.ref",
        "attribute.repository": "assertion.repository",
        "attribute.repository_owner": "assertion.repository_owner",
        "google.subject": "assertion.sub",
      },
      displayName: "GitHub repository provider",
      issuerUri: "https://token.actions.githubusercontent.com",
      location: "global",
      poolId: resolved.WIF_POOL_ID,
      projectId: resolved.PROJECT_ID,
      projectNumber,
      providerId: resolved.WIF_PROVIDER_ID,
    },
  );

  await deps.iam.ensureServiceAccountIamBinding({
    member: `principalSet://iam.googleapis.com/${workloadIdentity.poolName}/attribute.repository/${resolved.GITHUB_REPOSITORY}`,
    projectId: resolved.PROJECT_ID,
    role: "roles/iam.workloadIdentityUser",
    serviceAccountEmail: deployerServiceAccountEmail,
  });
  await deps.iam.ensureProjectIamBinding({
    member: `serviceAccount:${deployerServiceAccountEmail}`,
    projectId: resolved.PROJECT_ID,
    role: "roles/run.admin",
  });
  await deps.iam.ensureServiceAccountIamBinding({
    member: `serviceAccount:${deployerServiceAccountEmail}`,
    projectId: resolved.PROJECT_ID,
    role: "roles/iam.serviceAccountUser",
    serviceAccountEmail: runtimeServiceAccountEmail,
  });
  await deps.artifactRegistry.ensureRepositoryIamBinding({
    member: `serviceAccount:${deployerServiceAccountEmail}`,
    projectId: resolved.PROJECT_ID,
    region: resolved.CLOUD_RUN_REGION,
    repository: resolved.ARTIFACT_REGISTRY_REPOSITORY,
    role: "roles/artifactregistry.writer",
  });

  return {
    CLOUD_RUN_REGION: resolved.CLOUD_RUN_REGION,
    CLOUD_RUN_RUNTIME_SERVICE_ACCOUNT: runtimeServiceAccountEmail,
    CLOUD_RUN_SERVICE: resolved.CLOUD_RUN_SERVICE,
    GCP_ARTIFACT_REGISTRY_REPOSITORY: resolved.ARTIFACT_REGISTRY_REPOSITORY,
    GCP_PROJECT_ID: resolved.PROJECT_ID,
    GCP_SERVICE_ACCOUNT: deployerServiceAccountEmail,
    GCP_WORKLOAD_IDENTITY_PROVIDER: workloadIdentity.providerName,
    PROJECT_ID: resolved.PROJECT_ID,
    PROJECT_NUMBER: projectNumber,
  };
}

export function resolveBootstrapCloudRunInput(
  input: BootstrapCloudRunInput,
): ResolvedBootstrapCloudRunInput {
  const projectName = input.PROJECT_NAME ?? input.PROJECT_ID;

  return {
    ARTIFACT_REGISTRY_REPOSITORY:
      input.ARTIFACT_REGISTRY_REPOSITORY ?? "cloud-run-backend",
    ...(input.BILLING_ACCOUNT_ID === undefined ||
    input.BILLING_ACCOUNT_ID === ""
      ? {}
      : { BILLING_ACCOUNT_ID: input.BILLING_ACCOUNT_ID }),
    CLOUD_RUN_REGION: input.CLOUD_RUN_REGION ?? "europe-west4",
    CLOUD_RUN_SERVICE: input.CLOUD_RUN_SERVICE ?? "api",
    DEPLOYER_SERVICE_ACCOUNT_ID:
      input.DEPLOYER_SERVICE_ACCOUNT_ID ?? "github-actions-deployer",
    GITHUB_OWNER: input.GITHUB_OWNER ?? input.GITHUB_REPOSITORY.split("/")[0],
    GITHUB_REPOSITORY: input.GITHUB_REPOSITORY,
    PROJECT_ID: input.PROJECT_ID,
    PROJECT_NAME: projectName,
    RUNTIME_SERVICE_ACCOUNT_ID:
      input.RUNTIME_SERVICE_ACCOUNT_ID ?? "cloud-run-runtime",
    WIF_POOL_ID: input.WIF_POOL_ID ?? "github-actions",
    WIF_PROVIDER_ID: input.WIF_PROVIDER_ID ?? "github",
  };
}

function serviceAccountEmail(input: {
  accountId: string;
  projectId: string;
}): string {
  return `${input.accountId}@${input.projectId}.iam.gserviceaccount.com`;
}
