import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  automaticDeploymentStatus,
  pagesUrl,
  prepareCloudflarePagesProject,
  resolvePrepareCloudflarePagesProjectInput,
} from "../src/index.js";
import type { CloudflarePagesProviderDeps } from "../src/index.js";

describe("Cloudflare Pages project preparation", () => {
  it("resolves production provisioning defaults", () => {
    assert.deepEqual(
      resolvePrepareCloudflarePagesProjectInput({
        CLOUDFLARE_ACCOUNT_ID: " account ",
        CLOUDFLARE_PAGES_PROJECT_NAME: " demo-webapp ",
      }),
      {
        CLOUDFLARE_ACCOUNT_ID: "account",
        CLOUDFLARE_PAGES_DISABLE_AUTOMATIC_DEPLOYMENTS: true,
        CLOUDFLARE_PAGES_PRODUCTION_BRANCH: "main",
        CLOUDFLARE_PAGES_PROJECT_NAME: "demo-webapp",
      },
    );
  });

  it("ensures the project and disables automatic deployments by default", async () => {
    const calls: Array<{
      input: unknown;
      name: string;
    }> = [];
    const deps: Pick<CloudflarePagesProviderDeps, "pages"> = {
      pages: {
        disableAutomaticDeployments: async (input) => {
          calls.push({ input, name: "disableAutomaticDeployments" });

          return {
            name: input.projectName,
            source: {
              config: {
                deployments_enabled: false,
                preview_deployment_setting: "none",
                production_deployments_enabled: false,
              },
            },
          };
        },
        ensureProject: async (input) => {
          calls.push({ input, name: "ensureProject" });

          return {
            name: input.projectName,
            production_branch: input.productionBranch,
            source: {
              config: {
                deployments_enabled: true,
                preview_deployment_setting: "all",
                production_deployments_enabled: true,
              },
            },
          };
        },
      },
    };

    assert.deepEqual(
      await prepareCloudflarePagesProject(
        {
          CLOUDFLARE_ACCOUNT_ID: "account",
          CLOUDFLARE_PAGES_PROJECT_NAME: "demo-webapp",
        },
        deps,
      ),
      {
        CLOUDFLARE_ACCOUNT_ID: "account",
        CLOUDFLARE_PAGES_AUTOMATIC_DEPLOYMENTS: "disabled",
        CLOUDFLARE_PAGES_PRODUCTION_BRANCH: "main",
        CLOUDFLARE_PAGES_PROJECT_NAME: "demo-webapp",
        CLOUDFLARE_PAGES_PROJECT_READY: "true",
        WEBAPP_URL: "https://demo-webapp.pages.dev",
      },
    );
    assert.deepEqual(calls, [
      {
        input: {
          accountId: "account",
          productionBranch: "main",
          projectName: "demo-webapp",
        },
        name: "ensureProject",
      },
      {
        input: {
          accountId: "account",
          productionBranch: "main",
          projectName: "demo-webapp",
        },
        name: "disableAutomaticDeployments",
      },
    ]);
  });

  it("can leave existing automatic deployment controls unchanged", async () => {
    const calls: string[] = [];
    const deps: Pick<CloudflarePagesProviderDeps, "pages"> = {
      pages: {
        disableAutomaticDeployments: async () => {
          calls.push("disableAutomaticDeployments");
          throw new Error("must not be called");
        },
        ensureProject: async () => {
          calls.push("ensureProject");

          return {
            name: "demo-webapp",
            source: {
              config: {
                deployments_enabled: true,
                preview_deployment_setting: "all",
                production_deployments_enabled: true,
              },
            },
          };
        },
      },
    };

    const output = await prepareCloudflarePagesProject(
      {
        CLOUDFLARE_ACCOUNT_ID: "account",
        CLOUDFLARE_PAGES_DISABLE_AUTOMATIC_DEPLOYMENTS: false,
        CLOUDFLARE_PAGES_PRODUCTION_BRANCH: "release",
        CLOUDFLARE_PAGES_PROJECT_NAME: "demo-webapp",
      },
      deps,
    );

    assert.equal(output.CLOUDFLARE_PAGES_AUTOMATIC_DEPLOYMENTS, "unchanged");
    assert.equal(output.CLOUDFLARE_PAGES_PRODUCTION_BRANCH, "release");
    assert.deepEqual(calls, ["ensureProject"]);
  });

  it("does not patch Git deployment controls for direct-upload projects", async () => {
    const calls: string[] = [];
    const deps: Pick<CloudflarePagesProviderDeps, "pages"> = {
      pages: {
        disableAutomaticDeployments: async () => {
          calls.push("disableAutomaticDeployments");
          throw new Error("must not be called");
        },
        ensureProject: async () => {
          calls.push("ensureProject");

          return {
            name: "demo-webapp",
          };
        },
      },
    };

    const output = await prepareCloudflarePagesProject(
      {
        CLOUDFLARE_ACCOUNT_ID: "account",
        CLOUDFLARE_PAGES_PROJECT_NAME: "demo-webapp",
      },
      deps,
    );

    assert.equal(
      output.CLOUDFLARE_PAGES_AUTOMATIC_DEPLOYMENTS,
      "not_applicable",
    );
    assert.deepEqual(calls, ["ensureProject"]);
  });

  it("reports direct-upload projects as not applicable for Git deployment controls", () => {
    assert.equal(
      automaticDeploymentStatus({
        name: "demo-webapp",
      }),
      "not_applicable",
    );
  });

  it("formats the generated Pages production URL", () => {
    assert.equal(pagesUrl("demo-webapp"), "https://demo-webapp.pages.dev");
  });
});
