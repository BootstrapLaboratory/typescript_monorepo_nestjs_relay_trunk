import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createGoogleProjectStep,
  createCloudRunCloudflareNeonUpstashScenario,
  generateGoogleProjectId,
} from "../../scenarios/cloudrun-cloudflare-neon-upstash/scenario.mjs";
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

  it("runs the current project setup and Cloud Run bootstrap slice with injected provider functions", async () => {
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
    };
    const scenario = createCloudRunCloudflareNeonUpstashScenario({
      cloudRun: { provider },
      googleProject: { randomSuffix: "a7f3c2" },
    });
    const store = createMemoryStore();
    const ui = createScriptedUi({
      GITHUB_REPOSITORY: "BeltOrg/beltapp",
      PROJECT_NAME: "Demo Project",
    });

    const result = await runScenarioXState(scenario, {
      store,
      ui,
    });

    assert.equal(scenario.id, "cloudrun-cloudflare-neon-upstash");
    assert.deepEqual(
      scenario.steps.map((step) => step.id),
      ["google.project", "cloudrun.bootstrap"],
    );
    assert.deepEqual(
      ui.prompted.map((input) => input.name),
      ["PROJECT_NAME", "GITHUB_REPOSITORY"],
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
    ]);
    assert.equal(result.values.GCP_PROJECT_ID, "demo-project-a7f3c2");
    assert.equal(result.values.PROJECT_ID, "demo-project-a7f3c2");
    assert.equal(result.values.PROJECT_NAME, "Demo Project");
    assert.equal(result.values.PROJECT_NUMBER, "123456789");
  });
});
