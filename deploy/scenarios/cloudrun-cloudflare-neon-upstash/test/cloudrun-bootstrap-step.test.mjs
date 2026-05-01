import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { scenario } from "deploy-scenario-engine/src/define.mjs";
import { runScenarioXState } from "deploy-scenario-engine/src/xstate-runner.mjs";
import {
  CLOUD_RUN_BOOTSTRAP_OUTPUTS,
  createCloudRunBootstrapStep,
} from "../steps/cloudrun-bootstrap.mjs";
import {
  createMemoryStore,
  createScriptedUi,
} from "deploy-scenario-engine/test/fixtures.mjs";

describe("Cloud Run bootstrap scenario action", () => {
  it("waits for manual billing enablement and retries bootstrap", async () => {
    const calls = [];
    const provider = {
      bootstrapCloudRun: async (input) => {
        calls.push(input);

        if (calls.length === 1) {
          throw Object.assign(
            new Error(
              "9 FAILED_PRECONDITION: Billing account for project '123' is not found. Billing must be enabled.",
            ),
            {
              code: 9,
            },
          );
        }

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
      createGoogleCloudRunProviderDeps: () => ({}),
    };
    const step = createCloudRunBootstrapStep({ provider });
    const store = createMemoryStore();
    const ui = createScriptedUi({});

    const result = await runScenarioXState(
      scenario({
        id: "billing-retry-test",
        steps: [step],
        title: "Billing Retry Test",
      }),
      {
        store,
        ui,
        values: {
          GITHUB_REPOSITORY: "BeltOrg/beltapp",
          PROJECT_ID: "demo-project",
        },
      },
    );

    assert.equal(calls.length, 2);
    assert.equal(ui.continued.length, 1);
    assert.match(ui.continued[0].message, /Enable billing/);
    assert.equal(result.values.PROJECT_NUMBER, "123456789");
  });

  it("turns missing Google credentials into an actionable error", async () => {
    const step = createCloudRunBootstrapStep({
      provider: {
        bootstrapCloudRun: async () => {
          throw new Error("Could not load the default credentials.");
        },
        createGoogleCloudRunProviderDeps: () => ({}),
      },
    });

    await assert.rejects(
      () =>
        step.run({
          GITHUB_REPOSITORY: "BeltOrg/beltapp",
          PROJECT_ID: "demo-project",
        }),
      /gcloud auth application-default login --disable-quota-project/,
    );
  });

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
    assert.equal(
      step.inputs.GITHUB_REPOSITORY.label,
      "GitHub repository (ex: owner/repo)",
    );
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
          GITHUB_REPOSITORY: "BeltOrg/beltapp",
          PROJECT_ID: "demo-project",
          PROJECT_NUMBER: "123456789",
        },
        stepId: "cloudrun.bootstrap",
      },
    ]);
    assert.equal(result.values.PROJECT_NUMBER, "123456789");
    assert.equal(result.values.GCP_PROJECT_ID, "demo-project");
    assert.equal(result.values.GITHUB_REPOSITORY, "BeltOrg/beltapp");
  });
});
