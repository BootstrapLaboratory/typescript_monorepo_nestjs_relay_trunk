import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  bootstrapCloudRun,
  REQUIRED_BOOTSTRAP_SERVICES,
  resolveBootstrapCloudRunInput,
} from "../src/bootstrap.js";
import type { CloudRunProviderDeps } from "../src/types.js";

describe("Cloud Run provider bootstrap spike", () => {
  it("resolves bash-compatible defaults", () => {
    assert.deepEqual(
      resolveBootstrapCloudRunInput({
        GITHUB_REPOSITORY: "BeltOrg/beltapp",
        PROJECT_ID: "demo-project",
      }),
      {
        ARTIFACT_REGISTRY_REPOSITORY: "cloud-run-backend",
        CLOUD_RUN_REGION: "europe-west4",
        CLOUD_RUN_SERVICE: "api",
        DEPLOYER_SERVICE_ACCOUNT_ID: "github-actions-deployer",
        GITHUB_OWNER: "BeltOrg",
        GITHUB_REPOSITORY: "BeltOrg/beltapp",
        PROJECT_ID: "demo-project",
        PROJECT_NAME: "demo-project",
        RUNTIME_SERVICE_ACCOUNT_ID: "cloud-run-runtime",
        WIF_POOL_ID: "github-actions",
        WIF_PROVIDER_ID: "github",
      },
    );
  });

  it("orchestrates bootstrap actions through provider deps", async () => {
    const calls: string[] = [];
    const deps = createRecordingDeps(calls);

    const output = await bootstrapCloudRun(
      {
        BILLING_ACCOUNT_ID: "billing-123",
        GITHUB_REPOSITORY: "BeltOrg/beltapp",
        PROJECT_ID: "demo-project",
      },
      deps,
    );

    assert.deepEqual(calls, [
      "projects.ensureProject:demo-project",
      "billing.linkProject:billing-123",
      "projects.getProjectNumber:demo-project",
      `services.enableServices:${REQUIRED_BOOTSTRAP_SERVICES.join(",")}`,
      "artifactRegistry.ensureDockerRepository:cloud-run-backend",
      "iam.ensureServiceAccount:github-actions-deployer",
      "iam.ensureServiceAccount:cloud-run-runtime",
      "workloadIdentity.ensureGithubOidcProvider:github-actions/github",
      "iam.ensureServiceAccountIamBinding:roles/iam.workloadIdentityUser",
      "iam.ensureProjectIamBinding:roles/run.admin",
      "iam.ensureServiceAccountIamBinding:roles/iam.serviceAccountUser",
      "artifactRegistry.ensureRepositoryIamBinding:roles/artifactregistry.writer",
    ]);
    assert.deepEqual(output, {
      CLOUD_RUN_REGION: "europe-west4",
      CLOUD_RUN_RUNTIME_SERVICE_ACCOUNT:
        "cloud-run-runtime@demo-project.iam.gserviceaccount.com",
      CLOUD_RUN_SERVICE: "api",
      GCP_ARTIFACT_REGISTRY_REPOSITORY: "cloud-run-backend",
      GCP_PROJECT_ID: "demo-project",
      GCP_SERVICE_ACCOUNT:
        "github-actions-deployer@demo-project.iam.gserviceaccount.com",
      GCP_WORKLOAD_IDENTITY_PROVIDER:
        "projects/123456789/locations/global/workloadIdentityPools/github-actions/providers/github",
      PROJECT_ID: "demo-project",
      PROJECT_NUMBER: "123456789",
    });
  });

  it("skips billing when the billing account is omitted", async () => {
    const calls: string[] = [];
    const deps = createRecordingDeps(calls);

    await bootstrapCloudRun(
      {
        GITHUB_REPOSITORY: "BeltOrg/beltapp",
        PROJECT_ID: "demo-project",
      },
      deps,
    );

    assert.equal(
      calls.some((call) => call.startsWith("billing.linkProject")),
      false,
    );
  });
});

function createRecordingDeps(calls: string[]): CloudRunProviderDeps {
  return {
    artifactRegistry: {
      async ensureDockerRepository(input) {
        calls.push(
          `artifactRegistry.ensureDockerRepository:${input.repository}`,
        );
      },
      async ensureRepositoryIamBinding(input) {
        calls.push(
          `artifactRegistry.ensureRepositoryIamBinding:${input.role}`,
        );
      },
    },
    billing: {
      async linkProject(input) {
        calls.push(`billing.linkProject:${input.billingAccountId}`);
      },
    },
    iam: {
      async ensureProjectIamBinding(input) {
        calls.push(`iam.ensureProjectIamBinding:${input.role}`);
      },
      async ensureServiceAccount(input) {
        calls.push(`iam.ensureServiceAccount:${input.accountId}`);
      },
      async ensureServiceAccountIamBinding(input) {
        calls.push(`iam.ensureServiceAccountIamBinding:${input.role}`);
      },
    },
    projects: {
      async ensureProject(input) {
        calls.push(`projects.ensureProject:${input.projectId}`);
      },
      async getProjectNumber(projectId) {
        calls.push(`projects.getProjectNumber:${projectId}`);
        return "123456789";
      },
    },
    services: {
      async enableServices(input) {
        assert.equal(input.projectNumber, "123456789");
        calls.push(`services.enableServices:${input.services.join(",")}`);
      },
    },
    workloadIdentity: {
      async ensureGithubOidcProvider(input) {
        calls.push(
          `workloadIdentity.ensureGithubOidcProvider:${input.poolId}/${input.providerId}`,
        );
        return {
          poolName:
            "projects/123456789/locations/global/workloadIdentityPools/github-actions",
          providerName:
            "projects/123456789/locations/global/workloadIdentityPools/github-actions/providers/github",
        };
      },
    },
  };
}
