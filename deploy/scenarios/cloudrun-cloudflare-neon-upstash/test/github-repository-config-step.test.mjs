import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createGitHubRepositoryConfigStep,
  resolveGitHubRepositoryConfigInput,
} from "../steps/github-repository-config.mjs";

describe("GitHub repository configuration scenario action", () => {
  it("derives GitHub deploy values and calls configureGitHubRepository", async () => {
    const calls = [];
    const deps = { fake: "github-deps" };
    const provider = {
      configureGitHubRepository: async (input, receivedDeps) => {
        calls.push({ deps: receivedDeps, input });

        return {
          GITHUB_REPOSITORY_CONFIGURED: "true",
        };
      },
      createGitHubProviderDeps: () => deps,
    };
    const step = createGitHubRepositoryConfigStep({ provider });

    assert.deepEqual(
      await step.run({
        CLOUDFLARE_ACCOUNT_ID: "cloudflare-account",
        CLOUDFLARE_API_TOKEN: "cloudflare-token",
        CLOUDFLARE_PAGES_PROJECT_NAME: "demo-webapp",
        CLOUD_RUN_REGION: "europe-west4",
        CLOUD_RUN_RUNTIME_SERVICE_ACCOUNT:
          "runtime@demo-project.iam.gserviceaccount.com",
        CLOUD_RUN_SERVICE: "api",
        GCP_ARTIFACT_REGISTRY_REPOSITORY: "cloud-run-backend",
        GCP_PROJECT_ID: "demo-project",
        GCP_SERVICE_ACCOUNT:
          "deployer@demo-project.iam.gserviceaccount.com",
        GCP_WORKLOAD_IDENTITY_PROVIDER:
          "projects/123/locations/global/workloadIdentityPools/github-actions/providers/github",
        GITHUB_REPOSITORY: "BeltOrg/beltapp",
        PROJECT_NUMBER: "123456789",
        WEBAPP_URL: "https://demo-webapp.pages.dev",
      }),
      {
        CLOUD_RUN_CORS_ORIGIN: "https://demo-webapp.pages.dev",
        GITHUB_REPOSITORY_CONFIGURED: "true",
        WEBAPP_VITE_GRAPHQL_HTTP:
          "https://api-123456789.europe-west4.run.app/graphql",
        WEBAPP_VITE_GRAPHQL_WS:
          "wss://api-123456789.europe-west4.run.app/graphql",
      },
    );
    assert.deepEqual(calls, [
      {
        deps,
        input: {
          CLOUDFLARE_ACCOUNT_ID: "cloudflare-account",
          CLOUDFLARE_API_TOKEN: "cloudflare-token",
          CLOUDFLARE_PAGES_PROJECT_NAME: "demo-webapp",
          CLOUD_RUN_CORS_ORIGIN: "https://demo-webapp.pages.dev",
          CLOUD_RUN_RUNTIME_SERVICE_ACCOUNT:
            "runtime@demo-project.iam.gserviceaccount.com",
          CLOUD_RUN_SERVICE: "api",
          GCP_ARTIFACT_REGISTRY_REPOSITORY: "cloud-run-backend",
          GCP_PROJECT_ID: "demo-project",
          GCP_SERVICE_ACCOUNT:
            "deployer@demo-project.iam.gserviceaccount.com",
          GCP_WORKLOAD_IDENTITY_PROVIDER:
            "projects/123/locations/global/workloadIdentityPools/github-actions/providers/github",
          GITHUB_REPOSITORY: "BeltOrg/beltapp",
          WEBAPP_VITE_GRAPHQL_HTTP:
            "https://api-123456789.europe-west4.run.app/graphql",
          WEBAPP_VITE_GRAPHQL_WS:
            "wss://api-123456789.europe-west4.run.app/graphql",
        },
      },
    ]);
  });

  it("accepts explicit GraphQL URL and CORS overrides", () => {
    const resolved = resolveGitHubRepositoryConfigInput({
      CLOUDFLARE_ACCOUNT_ID: "cloudflare-account",
      CLOUDFLARE_API_TOKEN: "cloudflare-token",
      CLOUDFLARE_PAGES_PROJECT_NAME: "demo-webapp",
      CLOUD_RUN_CORS_ORIGIN: "https://app.example.com/",
      CLOUD_RUN_REGION: "europe-west4",
      CLOUD_RUN_RUNTIME_SERVICE_ACCOUNT:
        "runtime@demo-project.iam.gserviceaccount.com",
      CLOUD_RUN_SERVICE: "api",
      GCP_ARTIFACT_REGISTRY_REPOSITORY: "cloud-run-backend",
      GCP_PROJECT_ID: "demo-project",
      GCP_SERVICE_ACCOUNT: "deployer@demo-project.iam.gserviceaccount.com",
      GCP_WORKLOAD_IDENTITY_PROVIDER:
        "projects/123/locations/global/workloadIdentityPools/github-actions/providers/github",
      GITHUB_REPOSITORY: "BeltOrg/beltapp",
      PROJECT_NUMBER: "123456789",
      WEBAPP_URL: "https://demo-webapp.pages.dev",
      WEBAPP_VITE_GRAPHQL_HTTP: "https://api.example.com/graphql",
      WEBAPP_VITE_GRAPHQL_WS: "wss://api.example.com/graphql",
    });

    assert.equal(resolved.CLOUD_RUN_CORS_ORIGIN, "https://app.example.com");
    assert.equal(
      resolved.WEBAPP_VITE_GRAPHQL_HTTP,
      "https://api.example.com/graphql",
    );
    assert.equal(
      resolved.WEBAPP_VITE_GRAPHQL_WS,
      "wss://api.example.com/graphql",
    );
  });

  it("validates GraphQL URLs", () => {
    assert.throws(
      () =>
        resolveGitHubRepositoryConfigInput({
          CLOUDFLARE_ACCOUNT_ID: "cloudflare-account",
          CLOUDFLARE_API_TOKEN: "cloudflare-token",
          CLOUDFLARE_PAGES_PROJECT_NAME: "demo-webapp",
          CLOUD_RUN_REGION: "europe-west4",
          CLOUD_RUN_RUNTIME_SERVICE_ACCOUNT:
            "runtime@demo-project.iam.gserviceaccount.com",
          CLOUD_RUN_SERVICE: "api",
          GCP_ARTIFACT_REGISTRY_REPOSITORY: "cloud-run-backend",
          GCP_PROJECT_ID: "demo-project",
          GCP_SERVICE_ACCOUNT:
            "deployer@demo-project.iam.gserviceaccount.com",
          GCP_WORKLOAD_IDENTITY_PROVIDER:
            "projects/123/locations/global/workloadIdentityPools/github-actions/providers/github",
          GITHUB_REPOSITORY: "BeltOrg/beltapp",
          PROJECT_NUMBER: "123456789",
          WEBAPP_URL: "https://demo-webapp.pages.dev",
          WEBAPP_VITE_GRAPHQL_HTTP: "https://api.example.com/not-graphql",
        }),
      /WEBAPP_VITE_GRAPHQL_HTTP must end with \/graphql/,
    );
  });
});
