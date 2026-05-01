import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { scenario } from "deploy-scenario-engine/src/define.mjs";
import { redactScenarioValues } from "deploy-scenario-engine/src/runtime.mjs";
import { runScenarioXState } from "deploy-scenario-engine/src/xstate-runner.mjs";
import {
  CLOUDFLARE_PAGES_PROJECT_OUTPUTS,
  createCloudflarePagesProjectStep,
} from "../steps/cloudflare-pages-project.mjs";
import {
  createMemoryStore,
  createScriptedUi,
} from "deploy-scenario-engine/test/fixtures.mjs";

describe("Cloudflare Pages project scenario action", () => {
  it("maps scenario inputs to prepareCloudflarePagesProject and persists safe outputs", async () => {
    const calls = [];
    const deps = { fake: "deps" };
    const provider = {
      createCloudflarePagesProviderDeps: (input) => {
        calls.push({ input, name: "createCloudflarePagesProviderDeps" });

        return deps;
      },
      prepareCloudflarePagesProject: async (input, receivedDeps) => {
        calls.push({
          deps: receivedDeps,
          input,
          name: "prepareCloudflarePagesProject",
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
    const step = createCloudflarePagesProjectStep({ provider });
    const store = createMemoryStore();
    const ui = createScriptedUi({
      CLOUDFLARE_ACCOUNT_ID: "cloudflare-account",
      CLOUDFLARE_API_TOKEN: "cloudflare-secret-token",
      CLOUDFLARE_PAGES_PROJECT_NAME: "demo-webapp",
    });

    const result = await runScenarioXState(
      scenario({
        id: "cloudflare-pages-action-test",
        steps: [step],
        title: "Cloudflare Pages Action Test",
      }),
      {
        store,
        ui,
        values: {
          CLOUDFLARE_PAGES_PRODUCTION_BRANCH: "release",
        },
      },
    );

    assert.deepEqual(
      ui.prompted.map((input) => input.name),
      [
        "CLOUDFLARE_ACCOUNT_ID",
        "CLOUDFLARE_API_TOKEN",
        "CLOUDFLARE_PAGES_PROJECT_NAME",
      ],
    );
    assert.deepEqual(calls, [
      {
        input: {
          apiToken: "cloudflare-secret-token",
        },
        name: "createCloudflarePagesProviderDeps",
      },
      {
        deps,
        input: {
          CLOUDFLARE_ACCOUNT_ID: "cloudflare-account",
          CLOUDFLARE_API_TOKEN: "cloudflare-secret-token",
          CLOUDFLARE_PAGES_PRODUCTION_BRANCH: "release",
          CLOUDFLARE_PAGES_PROJECT_NAME: "demo-webapp",
        },
        name: "prepareCloudflarePagesProject",
      },
    ]);
    assert.deepEqual(step.outputs, CLOUDFLARE_PAGES_PROJECT_OUTPUTS);
    assert.equal(step.inputs.CLOUDFLARE_API_TOKEN.kind, "secret");
    assert.deepEqual(store.saved, [
      {
        output: {
          CLOUDFLARE_ACCOUNT_ID: "cloudflare-account",
          CLOUDFLARE_PAGES_AUTOMATIC_DEPLOYMENTS: "disabled",
          CLOUDFLARE_PAGES_PRODUCTION_BRANCH: "release",
          CLOUDFLARE_PAGES_PROJECT_NAME: "demo-webapp",
          CLOUDFLARE_PAGES_PROJECT_READY: "true",
          WEBAPP_URL: "https://demo-webapp.pages.dev",
        },
        stepId: "cloudflare-pages.project",
      },
    ]);
    assert.equal(result.values.CLOUDFLARE_API_TOKEN, "cloudflare-secret-token");
    assert.deepEqual(redactScenarioValues({ steps: [step] }, result.values), {
      CLOUDFLARE_ACCOUNT_ID: "cloudflare-account",
      CLOUDFLARE_PAGES_AUTOMATIC_DEPLOYMENTS: "disabled",
      CLOUDFLARE_PAGES_PRODUCTION_BRANCH: "release",
      CLOUDFLARE_PAGES_PROJECT_NAME: "demo-webapp",
      CLOUDFLARE_PAGES_PROJECT_READY: "true",
      WEBAPP_URL: "https://demo-webapp.pages.dev",
    });
  });
});
