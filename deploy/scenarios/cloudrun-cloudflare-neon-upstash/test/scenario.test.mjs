import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createGoogleProjectStep,
  createCloudRunCloudflareNeonUpstashScenario,
  createNeonDatabaseStep,
  createUpstashRedisStep,
  generateGoogleProjectId,
} from "../scenario.mjs";
import {
  formatCompletionSections,
} from "deploy-scenario-engine/src/completion-summary.mjs";
import { redactScenarioValues } from "deploy-scenario-engine/src/runtime.mjs";
import { runScenarioXState } from "deploy-scenario-engine/src/xstate-runner.mjs";
import {
  createMemoryStore,
  createScriptedUi,
} from "deploy-scenario-engine/test/fixtures.mjs";

describe("Cloud Run + Cloudflare + Neon + Upstash scenario", () => {
  it("generates a Google Cloud project ID unless an override is supplied", async () => {
    const step = createGoogleProjectStep({ randomSuffix: "a7f3c2" });

    assert.deepEqual(await step.run({ PROJECT_NAME: "Demo Project" }), {
      PROJECT_ID: "demo-project-a7f3c2",
      PROJECT_NAME: "Demo Project",
    });
    assert.deepEqual(
      await step.run({
        PROJECT_ID: "custom-project-id",
        PROJECT_NAME: "Demo Project",
      }),
      {
        PROJECT_ID: "custom-project-id",
        PROJECT_NAME: "Demo Project",
      },
    );
    assert.match(
      generateGoogleProjectId("123 Demo Project With A Very Long Name", {
        randomSuffix: "a7f3c2",
      }),
      /^[a-z][a-z0-9-]{4,28}[a-z0-9]$/,
    );
  });

  it("validates Neon database URLs without returning secret outputs", async () => {
    const step = createNeonDatabaseStep();

    assert.deepEqual(
      await step.run({
        DATABASE_URL: "postgres://app:secret@example.test/app?sslmode=require",
        DATABASE_URL_DIRECT:
          "postgresql://owner:secret@example.test/app?sslmode=require",
      }),
      {
        NEON_DATABASE_URLS_READY: "true",
      },
    );
    await assert.rejects(
      () =>
        step.run({
          DATABASE_URL: "https://example.test",
          DATABASE_URL_DIRECT:
            "postgres://owner:secret@example.test/app?sslmode=require",
        }),
      /DATABASE_URL must use postgres:\/\/ or postgresql:\/\//,
    );
  });

  it("validates Upstash Redis URLs without returning secret outputs", async () => {
    const step = createUpstashRedisStep();

    assert.deepEqual(
      await step.run({
        REDIS_URL: "rediss://default:secret@example.upstash.io:6379",
      }),
      {
        UPSTASH_REDIS_URL_READY: "true",
      },
    );
    await assert.rejects(
      () =>
        step.run({
          REDIS_URL: "https://example.test",
        }),
      /REDIS_URL must use redis:\/\/ or rediss:\/\//,
    );
  });

  it("runs project setup, Cloud Run bootstrap, credentials, secret sync, Pages, and GitHub config slices", async () => {
    const cloudRunCalls = [];
    const cloudflareCalls = [];
    const githubCalls = [];
    const deps = { fake: "deps" };
    const cloudflareDeps = { fake: "cloudflare-deps" };
    const githubDeps = { fake: "github-deps" };
    const provider = {
      bootstrapCloudRun: async (input, receivedDeps) => {
        cloudRunCalls.push({ deps: receivedDeps, input });

        return {
          CLOUD_RUN_REGION: "europe-west4",
          CLOUD_RUN_RUNTIME_SERVICE_ACCOUNT:
            "cloud-run-runtime@demo-project.iam.gserviceaccount.com",
          CLOUD_RUN_SERVICE: "api",
          GCP_ARTIFACT_REGISTRY_REPOSITORY: "cloud-run-backend",
          GCP_PROJECT_ID: input.PROJECT_ID,
          GCP_SERVICE_ACCOUNT:
            "github-actions-deployer@demo-project.iam.gserviceaccount.com",
          GCP_WORKLOAD_IDENTITY_PROVIDER:
            "projects/123456789/locations/global/workloadIdentityPools/github-actions/providers/github",
          PROJECT_ID: input.PROJECT_ID,
          PROJECT_NUMBER: "123456789",
        };
      },
      createGoogleCloudRunProviderDeps: () => deps,
      syncCloudRunRuntimeSecrets: async (input, receivedDeps) => {
        cloudRunCalls.push({ deps: receivedDeps, input });

        return {
          CLOUD_RUN_RUNTIME_SECRETS_SYNCED: "true",
        };
      },
    };
    const cloudflareProvider = {
      createCloudflarePagesProviderDeps: (input) => {
        cloudflareCalls.push({ input, name: "createDeps" });

        return cloudflareDeps;
      },
      prepareCloudflarePagesProject: async (input, receivedDeps) => {
        cloudflareCalls.push({
          deps: receivedDeps,
          input,
          name: "prepareProject",
        });

        return {
          CLOUDFLARE_ACCOUNT_ID: input.CLOUDFLARE_ACCOUNT_ID,
          CLOUDFLARE_PAGES_AUTOMATIC_DEPLOYMENTS: "disabled",
          CLOUDFLARE_PAGES_PRODUCTION_BRANCH:
            input.CLOUDFLARE_PAGES_PRODUCTION_BRANCH ?? "main",
          CLOUDFLARE_PAGES_PROJECT_NAME:
            input.CLOUDFLARE_PAGES_PROJECT_NAME,
          CLOUDFLARE_PAGES_PROJECT_READY: "true",
          WEBAPP_URL: `https://${input.CLOUDFLARE_PAGES_PROJECT_NAME}.pages.dev`,
        };
      },
    };
    const githubProvider = {
      configureGitHubRepository: async (input, receivedDeps) => {
        githubCalls.push({
          deps: receivedDeps,
          input,
          name: "configureRepository",
        });

        return {
          GITHUB_REPOSITORY_CONFIGURED: "true",
        };
      },
      createGitHubProviderDeps: () => githubDeps,
    };
    const scenario = createCloudRunCloudflareNeonUpstashScenario({
      cloudflarePages: { provider: cloudflareProvider },
      cloudRun: { provider },
      github: { provider: githubProvider },
      googleProject: { randomSuffix: "a7f3c2" },
      runtimeSecrets: { provider },
    });
    const store = createMemoryStore();
    const ui = createScriptedUi({
      DATABASE_URL: "postgres://app:secret@example.test/app?sslmode=require",
      DATABASE_URL_DIRECT:
        "postgresql://owner:secret@example.test/app?sslmode=require",
      CLOUDFLARE_ACCOUNT_ID: "cloudflare-account",
      CLOUDFLARE_API_TOKEN: "cloudflare-secret-token",
      CLOUDFLARE_PAGES_PROJECT_NAME: "demo-webapp",
      GITHUB_REPOSITORY: "BeltOrg/beltapp",
      PROJECT_NAME: "Demo Project",
      REDIS_URL: "rediss://default:secret@example.upstash.io:6379",
    });

    const result = await runScenarioXState(scenario, {
      store,
      ui,
    });

    assert.equal(scenario.id, "cloudrun-cloudflare-neon-upstash");
    assert.deepEqual(
      scenario.steps.map((step) => step.id),
      [
        "google.project",
        "cloudrun.bootstrap",
        "neon.database",
        "upstash.redis",
        "cloudrun.runtime-secrets",
        "cloudflare-pages.project",
        "github.repository-config",
      ],
    );
    assert.deepEqual(
      ui.prompted.map((input) => input.name),
      [
        "PROJECT_NAME",
        "GITHUB_REPOSITORY",
        "DATABASE_URL",
        "DATABASE_URL_DIRECT",
        "REDIS_URL",
        "CLOUDFLARE_ACCOUNT_ID",
        "CLOUDFLARE_API_TOKEN",
        "CLOUDFLARE_PAGES_PROJECT_NAME",
      ],
    );
    assert.deepEqual(cloudRunCalls, [
      {
        deps,
        input: {
          GITHUB_REPOSITORY: "BeltOrg/beltapp",
          PROJECT_ID: "demo-project-a7f3c2",
          PROJECT_NAME: "Demo Project",
        },
      },
      {
        deps,
        input: {
          CLOUD_RUN_RUNTIME_SERVICE_ACCOUNT:
            "cloud-run-runtime@demo-project.iam.gserviceaccount.com",
          DATABASE_URL:
            "postgres://app:secret@example.test/app?sslmode=require",
          DATABASE_URL_DIRECT:
            "postgresql://owner:secret@example.test/app?sslmode=require",
          GCP_SERVICE_ACCOUNT:
            "github-actions-deployer@demo-project.iam.gserviceaccount.com",
          PROJECT_ID: "demo-project-a7f3c2",
          REDIS_URL: "rediss://default:secret@example.upstash.io:6379",
        },
      },
    ]);
    assert.deepEqual(cloudflareCalls, [
      {
        input: {
          apiToken: "cloudflare-secret-token",
        },
        name: "createDeps",
      },
      {
        deps: cloudflareDeps,
        input: {
          CLOUDFLARE_ACCOUNT_ID: "cloudflare-account",
          CLOUDFLARE_API_TOKEN: "cloudflare-secret-token",
          CLOUDFLARE_PAGES_PROJECT_NAME: "demo-webapp",
        },
        name: "prepareProject",
      },
    ]);
    assert.deepEqual(githubCalls, [
      {
        deps: githubDeps,
        input: {
          CLOUDFLARE_ACCOUNT_ID: "cloudflare-account",
          CLOUDFLARE_API_TOKEN: "cloudflare-secret-token",
          CLOUDFLARE_PAGES_PROJECT_NAME: "demo-webapp",
          CLOUD_RUN_CORS_ORIGIN: "https://demo-webapp.pages.dev",
          CLOUD_RUN_RUNTIME_SERVICE_ACCOUNT:
            "cloud-run-runtime@demo-project.iam.gserviceaccount.com",
          CLOUD_RUN_SERVICE: "api",
          GCP_ARTIFACT_REGISTRY_REPOSITORY: "cloud-run-backend",
          GCP_PROJECT_ID: "demo-project-a7f3c2",
          GCP_SERVICE_ACCOUNT:
            "github-actions-deployer@demo-project.iam.gserviceaccount.com",
          GCP_WORKLOAD_IDENTITY_PROVIDER:
            "projects/123456789/locations/global/workloadIdentityPools/github-actions/providers/github",
          GITHUB_REPOSITORY: "BeltOrg/beltapp",
          WEBAPP_VITE_GRAPHQL_HTTP:
            "https://api-123456789.europe-west4.run.app/graphql",
          WEBAPP_VITE_GRAPHQL_WS:
            "wss://api-123456789.europe-west4.run.app/graphql",
        },
        name: "configureRepository",
      },
    ]);
    assert.equal(result.values.CLOUD_RUN_CORS_ORIGIN, "https://demo-webapp.pages.dev");
    assert.equal(result.values.CLOUD_RUN_RUNTIME_SECRETS_SYNCED, "true");
    assert.equal(result.values.CLOUDFLARE_ACCOUNT_ID, "cloudflare-account");
    assert.equal(
      result.values.CLOUDFLARE_PAGES_AUTOMATIC_DEPLOYMENTS,
      "disabled",
    );
    assert.equal(result.values.CLOUDFLARE_PAGES_PROJECT_NAME, "demo-webapp");
    assert.equal(result.values.CLOUDFLARE_PAGES_PROJECT_READY, "true");
    assert.equal(result.values.GCP_PROJECT_ID, "demo-project-a7f3c2");
    assert.equal(result.values.GITHUB_REPOSITORY, "BeltOrg/beltapp");
    assert.equal(result.values.GITHUB_REPOSITORY_CONFIGURED, "true");
    assert.equal(result.values.NEON_DATABASE_URLS_READY, "true");
    assert.equal(result.values.PROJECT_ID, "demo-project-a7f3c2");
    assert.equal(result.values.PROJECT_NAME, "Demo Project");
    assert.equal(result.values.PROJECT_NUMBER, "123456789");
    assert.equal(result.values.UPSTASH_REDIS_URL_READY, "true");
    assert.equal(
      result.values.WEBAPP_VITE_GRAPHQL_HTTP,
      "https://api-123456789.europe-west4.run.app/graphql",
    );
    assert.equal(
      result.values.WEBAPP_VITE_GRAPHQL_WS,
      "wss://api-123456789.europe-west4.run.app/graphql",
    );
    assert.equal(
      result.values.DATABASE_URL,
      "postgres://app:secret@example.test/app?sslmode=require",
    );
    assert.equal(
      result.values.REDIS_URL,
      "rediss://default:secret@example.upstash.io:6379",
    );
    assert.deepEqual(
      store.saved.map((entry) => entry.output),
      [
        {
          PROJECT_ID: "demo-project-a7f3c2",
          PROJECT_NAME: "Demo Project",
        },
        {
          CLOUD_RUN_REGION: "europe-west4",
          CLOUD_RUN_RUNTIME_SERVICE_ACCOUNT:
            "cloud-run-runtime@demo-project.iam.gserviceaccount.com",
          CLOUD_RUN_SERVICE: "api",
          GCP_ARTIFACT_REGISTRY_REPOSITORY: "cloud-run-backend",
          GCP_PROJECT_ID: "demo-project-a7f3c2",
          GCP_SERVICE_ACCOUNT:
            "github-actions-deployer@demo-project.iam.gserviceaccount.com",
          GCP_WORKLOAD_IDENTITY_PROVIDER:
            "projects/123456789/locations/global/workloadIdentityPools/github-actions/providers/github",
          GITHUB_REPOSITORY: "BeltOrg/beltapp",
          PROJECT_ID: "demo-project-a7f3c2",
          PROJECT_NUMBER: "123456789",
        },
        {
          NEON_DATABASE_URLS_READY: "true",
        },
        {
          UPSTASH_REDIS_URL_READY: "true",
        },
        {
          CLOUD_RUN_RUNTIME_SECRETS_SYNCED: "true",
        },
        {
          CLOUDFLARE_ACCOUNT_ID: "cloudflare-account",
          CLOUDFLARE_PAGES_AUTOMATIC_DEPLOYMENTS: "disabled",
          CLOUDFLARE_PAGES_PRODUCTION_BRANCH: "main",
          CLOUDFLARE_PAGES_PROJECT_NAME: "demo-webapp",
          CLOUDFLARE_PAGES_PROJECT_READY: "true",
          WEBAPP_URL: "https://demo-webapp.pages.dev",
        },
        {
          CLOUD_RUN_CORS_ORIGIN: "https://demo-webapp.pages.dev",
          GITHUB_REPOSITORY_CONFIGURED: "true",
          WEBAPP_VITE_GRAPHQL_HTTP:
            "https://api-123456789.europe-west4.run.app/graphql",
          WEBAPP_VITE_GRAPHQL_WS:
            "wss://api-123456789.europe-west4.run.app/graphql",
        },
      ],
    );
    assert.deepEqual(redactScenarioValues(scenario, result.values), {
      CLOUD_RUN_REGION: "europe-west4",
      CLOUD_RUN_CORS_ORIGIN: "https://demo-webapp.pages.dev",
      CLOUD_RUN_RUNTIME_SECRETS_SYNCED: "true",
      CLOUD_RUN_RUNTIME_SERVICE_ACCOUNT:
        "cloud-run-runtime@demo-project.iam.gserviceaccount.com",
      CLOUD_RUN_SERVICE: "api",
      CLOUDFLARE_ACCOUNT_ID: "cloudflare-account",
      CLOUDFLARE_PAGES_AUTOMATIC_DEPLOYMENTS: "disabled",
      CLOUDFLARE_PAGES_PRODUCTION_BRANCH: "main",
      CLOUDFLARE_PAGES_PROJECT_NAME: "demo-webapp",
      CLOUDFLARE_PAGES_PROJECT_READY: "true",
      GCP_ARTIFACT_REGISTRY_REPOSITORY: "cloud-run-backend",
      GCP_PROJECT_ID: "demo-project-a7f3c2",
      GCP_SERVICE_ACCOUNT:
        "github-actions-deployer@demo-project.iam.gserviceaccount.com",
      GCP_WORKLOAD_IDENTITY_PROVIDER:
        "projects/123456789/locations/global/workloadIdentityPools/github-actions/providers/github",
      GITHUB_REPOSITORY: "BeltOrg/beltapp",
      GITHUB_REPOSITORY_CONFIGURED: "true",
      NEON_DATABASE_URLS_READY: "true",
      PROJECT_ID: "demo-project-a7f3c2",
      PROJECT_NAME: "Demo Project",
      PROJECT_NUMBER: "123456789",
      UPSTASH_REDIS_URL_READY: "true",
      WEBAPP_URL: "https://demo-webapp.pages.dev",
      WEBAPP_VITE_GRAPHQL_HTTP:
        "https://api-123456789.europe-west4.run.app/graphql",
      WEBAPP_VITE_GRAPHQL_WS:
        "wss://api-123456789.europe-west4.run.app/graphql",
    });

    const completion = formatCompletionSections(scenario, result.values);
    assert.match(completion, /Cloud Run backend GitHub variables/);
    assert.match(completion, /GCP_PROJECT_ID=demo-project-a7f3c2/);
    assert.match(completion, /CLOUD_RUN_SERVICE=api/);
    assert.match(completion, /Cloudflare Pages project/);
    assert.match(completion, /WEBAPP_URL=https:\/\/demo-webapp.pages.dev/);
    assert.match(completion, /GitHub repository configuration/);
    assert.match(completion, /GITHUB_REPOSITORY_CONFIGURED=true/);
    assert.match(
      completion,
      /WEBAPP_VITE_GRAPHQL_HTTP=https:\/\/api-123456789.europe-west4.run.app\/graphql/,
    );
    assert.match(completion, /not written to the scenario state file/);
    assert.match(completion, /Production provisioning\/setup is complete/);
    assert.match(completion, /does not trigger deployment automatically/);
    assert.match(
      completion,
      /gh workflow run main-workflow.yaml --repo BeltOrg\/beltapp --ref main/,
    );
    assert.doesNotMatch(completion, /app:secret/);
    assert.doesNotMatch(completion, /cloudflare-secret-token/);
    assert.doesNotMatch(completion, /default:secret/);
  });
});
