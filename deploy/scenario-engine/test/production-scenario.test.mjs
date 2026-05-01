import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createGoogleProjectStep,
  createCloudRunCloudflareNeonUpstashScenario,
  createNeonDatabaseStep,
  createUpstashRedisStep,
  generateGoogleProjectId,
} from "../../scenarios/cloudrun-cloudflare-neon-upstash/scenario.mjs";
import { formatCompletionSections } from "../src/completion-summary.mjs";
import { redactScenarioValues } from "../src/runtime.mjs";
import { runScenarioXState } from "../src/xstate-runner.mjs";
import { createMemoryStore, createScriptedUi } from "./fixtures.mjs";

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

  it("runs the current project setup, Cloud Run bootstrap, credentials, and secret sync slices", async () => {
    const calls = [];
    const deps = { fake: "deps" };
    const provider = {
      bootstrapCloudRun: async (input, receivedDeps) => {
        calls.push({ deps: receivedDeps, input });

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
        calls.push({ deps: receivedDeps, input });

        return {
          CLOUD_RUN_RUNTIME_SECRETS_SYNCED: "true",
        };
      },
    };
    const scenario = createCloudRunCloudflareNeonUpstashScenario({
      cloudRun: { provider },
      googleProject: { randomSuffix: "a7f3c2" },
      runtimeSecrets: { provider },
    });
    const store = createMemoryStore();
    const ui = createScriptedUi({
      DATABASE_URL: "postgres://app:secret@example.test/app?sslmode=require",
      DATABASE_URL_DIRECT:
        "postgresql://owner:secret@example.test/app?sslmode=require",
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
      ],
    );
    assert.deepEqual(calls, [
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
    assert.equal(result.values.CLOUD_RUN_RUNTIME_SECRETS_SYNCED, "true");
    assert.equal(result.values.GCP_PROJECT_ID, "demo-project-a7f3c2");
    assert.equal(result.values.GITHUB_REPOSITORY, "BeltOrg/beltapp");
    assert.equal(result.values.NEON_DATABASE_URLS_READY, "true");
    assert.equal(result.values.PROJECT_ID, "demo-project-a7f3c2");
    assert.equal(result.values.PROJECT_NAME, "Demo Project");
    assert.equal(result.values.PROJECT_NUMBER, "123456789");
    assert.equal(result.values.UPSTASH_REDIS_URL_READY, "true");
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
      ],
    );
    assert.deepEqual(redactScenarioValues(scenario, result.values), {
      CLOUD_RUN_REGION: "europe-west4",
      CLOUD_RUN_RUNTIME_SECRETS_SYNCED: "true",
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
      NEON_DATABASE_URLS_READY: "true",
      PROJECT_ID: "demo-project-a7f3c2",
      PROJECT_NAME: "Demo Project",
      PROJECT_NUMBER: "123456789",
      UPSTASH_REDIS_URL_READY: "true",
    });

    const completion = formatCompletionSections(scenario, result.values);
    assert.match(completion, /Cloud Run backend GitHub variables/);
    assert.match(completion, /GCP_PROJECT_ID=demo-project-a7f3c2/);
    assert.match(completion, /CLOUD_RUN_SERVICE=api/);
    assert.match(completion, /not written to the scenario state file/);
    assert.match(completion, /configure Cloudflare Pages/);
    assert.doesNotMatch(completion, /app:secret/);
    assert.doesNotMatch(completion, /default:secret/);
  });
});
