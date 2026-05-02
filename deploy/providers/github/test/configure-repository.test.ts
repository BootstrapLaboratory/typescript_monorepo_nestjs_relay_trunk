import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  configureGitHubRepository,
  GITHUB_REPOSITORY_SECRET_NAMES,
  GITHUB_REPOSITORY_VARIABLE_NAMES,
  resolveConfigureGitHubRepositoryInput,
} from "../src/index.js";
import type { GitHubProviderDeps } from "../src/index.js";

describe("GitHub repository configuration", () => {
  it("trims input and validates repository shape", () => {
    assert.equal(
      resolveConfigureGitHubRepositoryInput({
        ...validInput(),
        GITHUB_REPOSITORY: " BeltOrg/beltapp ",
      }).GITHUB_REPOSITORY,
      "BeltOrg/beltapp",
    );

    assert.throws(
      () =>
        resolveConfigureGitHubRepositoryInput({
          ...validInput(),
          GITHUB_REPOSITORY: "BeltOrg",
        }),
      /GITHUB_REPOSITORY must use owner\/repo format/,
    );
  });

  it("sets the expected repository variables and secrets", async () => {
    const calls: Array<{
      name: string;
      repository: string;
      type: "secret" | "variable";
      value: string;
    }> = [];
    const deps: Pick<GitHubProviderDeps, "repository"> = {
      repository: {
        async setSecret(input) {
          calls.push({ ...input, type: "secret" });
        },
        async setVariable(input) {
          calls.push({ ...input, type: "variable" });
        },
      },
    };

    assert.deepEqual(await configureGitHubRepository(validInput(), deps), {
      GITHUB_REPOSITORY_CONFIGURED: "true",
    });
    assert.deepEqual(GITHUB_REPOSITORY_VARIABLE_NAMES, [
      "GCP_PROJECT_ID",
      "GCP_WORKLOAD_IDENTITY_PROVIDER",
      "GCP_SERVICE_ACCOUNT",
      "GCP_ARTIFACT_REGISTRY_REPOSITORY",
      "CLOUD_RUN_SERVICE",
      "CLOUD_RUN_RUNTIME_SERVICE_ACCOUNT",
      "CLOUD_RUN_CORS_ORIGIN",
      "CLOUDFLARE_PAGES_PROJECT_NAME",
      "WEBAPP_VITE_GRAPHQL_HTTP",
      "WEBAPP_VITE_GRAPHQL_WS",
    ]);
    assert.deepEqual(GITHUB_REPOSITORY_SECRET_NAMES, [
      "CLOUDFLARE_API_TOKEN",
      "CLOUDFLARE_ACCOUNT_ID",
    ]);
    assert.deepEqual(
      calls.map((call) => `${call.type}:${call.name}:${call.value}`),
      [
        "variable:GCP_PROJECT_ID:demo-project",
        "variable:GCP_WORKLOAD_IDENTITY_PROVIDER:projects/123/locations/global/workloadIdentityPools/github-actions/providers/github",
        "variable:GCP_SERVICE_ACCOUNT:deployer@demo-project.iam.gserviceaccount.com",
        "variable:GCP_ARTIFACT_REGISTRY_REPOSITORY:cloud-run-backend",
        "variable:CLOUD_RUN_SERVICE:api",
        "variable:CLOUD_RUN_RUNTIME_SERVICE_ACCOUNT:runtime@demo-project.iam.gserviceaccount.com",
        "variable:CLOUD_RUN_CORS_ORIGIN:https://demo-webapp.pages.dev",
        "variable:CLOUDFLARE_PAGES_PROJECT_NAME:demo-webapp",
        "variable:WEBAPP_VITE_GRAPHQL_HTTP:https://api-123.europe-west4.run.app/graphql",
        "variable:WEBAPP_VITE_GRAPHQL_WS:wss://api-123.europe-west4.run.app/graphql",
        "secret:CLOUDFLARE_API_TOKEN:cloudflare-token",
        "secret:CLOUDFLARE_ACCOUNT_ID:cloudflare-account",
      ],
    );
  });
});

function validInput() {
  return {
    CLOUDFLARE_ACCOUNT_ID: "cloudflare-account",
    CLOUDFLARE_API_TOKEN: "cloudflare-token",
    CLOUDFLARE_PAGES_PROJECT_NAME: "demo-webapp",
    CLOUD_RUN_CORS_ORIGIN: "https://demo-webapp.pages.dev",
    CLOUD_RUN_RUNTIME_SERVICE_ACCOUNT:
      "runtime@demo-project.iam.gserviceaccount.com",
    CLOUD_RUN_SERVICE: "api",
    GCP_ARTIFACT_REGISTRY_REPOSITORY: "cloud-run-backend",
    GCP_PROJECT_ID: "demo-project",
    GCP_SERVICE_ACCOUNT: "deployer@demo-project.iam.gserviceaccount.com",
    GCP_WORKLOAD_IDENTITY_PROVIDER:
      "projects/123/locations/global/workloadIdentityPools/github-actions/providers/github",
    GITHUB_REPOSITORY: "BeltOrg/beltapp",
    WEBAPP_VITE_GRAPHQL_HTTP: "https://api-123.europe-west4.run.app/graphql",
    WEBAPP_VITE_GRAPHQL_WS: "wss://api-123.europe-west4.run.app/graphql",
  };
}
