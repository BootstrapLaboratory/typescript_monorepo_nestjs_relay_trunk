import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { scenario } from "../src/define.mjs";
import {
  CLOUD_RUN_BOOTSTRAP_OUTPUTS,
  createCloudRunBootstrapStep,
} from "../src/providers/cloudrun-bootstrap.mjs";
import { runScenarioXState } from "../src/xstate-runner.mjs";
import { createMemoryStore, createScriptedUi } from "./fixtures.mjs";

describe("Cloud Run bootstrap scenario action", () => {
  it("maps scenario inputs to bootstrapCloudRun and persists provider outputs", async () => {
    const calls = [];
    const deps = { fake: "deps" };
    const provider = {
      bootstrapCloudRun: async (input, receivedDeps) => {
        calls.push({ deps: receivedDeps, input });

        return {
          CLOUD_RUN_REGION: input.CLOUD_RUN_REGION,
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
    const step = createCloudRunBootstrapStep({ provider });
    const store = createMemoryStore();
    const ui = createScriptedUi({
      GITHUB_REPOSITORY: "BeltOrg/beltapp",
      PROJECT_ID: "demo-project",
    });

    const result = await runScenarioXState(
      scenario({
        id: "cloudrun-action-test",
        steps: [step],
        title: "Cloud Run Action Test",
      }),
      {
        store,
        ui,
        values: {
          CLOUD_RUN_REGION: "europe-west4",
        },
      },
    );

    assert.deepEqual(
      ui.prompted.map((input) => input.name),
      ["GITHUB_REPOSITORY", "PROJECT_ID"],
    );
    assert.deepEqual(calls, [
      {
        deps,
        input: {
          CLOUD_RUN_REGION: "europe-west4",
          GITHUB_REPOSITORY: "BeltOrg/beltapp",
          PROJECT_ID: "demo-project",
        },
      },
    ]);
    assert.deepEqual(step.outputs, CLOUD_RUN_BOOTSTRAP_OUTPUTS);
    assert.deepEqual(store.saved, [
      {
        output: {
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
        },
        stepId: "cloudrun.bootstrap",
      },
    ]);
    assert.equal(result.values.PROJECT_NUMBER, "123456789");
    assert.equal(result.values.GCP_PROJECT_ID, "demo-project");
  });
});
