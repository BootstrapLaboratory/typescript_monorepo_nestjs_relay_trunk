import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createCloudflarePagesClient,
  createCloudflarePagesDependency,
} from "../src/index.js";
import type {
  CloudflarePagesClientLike,
  CloudflarePagesProject,
} from "../src/index.js";

describe("Cloudflare Pages SDK dependency", () => {
  it("does not create an existing Pages project", async () => {
    const calls: Array<{
      name: string;
      params?: unknown;
      projectName?: string;
    }> = [];
    const deps = createCloudflarePagesDependency(
      fakeClient({
        get: async (projectName, params) => {
          calls.push({ name: "get", params, projectName });

          return {
            name: projectName,
            production_branch: "main",
          };
        },
      }),
    );

    assert.deepEqual(
      await deps.ensureProject({
        accountId: "account",
        productionBranch: "main",
        projectName: "demo-webapp",
      }),
      {
        name: "demo-webapp",
        production_branch: "main",
      },
    );
    assert.deepEqual(calls, [
      {
        name: "get",
        params: { account_id: "account" },
        projectName: "demo-webapp",
      },
    ]);
  });

  it("updates the production branch for an existing Pages project", async () => {
    const calls: Array<{
      name: string;
      params?: unknown;
      projectName?: string;
    }> = [];
    const deps = createCloudflarePagesDependency(
      fakeClient({
        edit: async (projectName, params) => {
          calls.push({ name: "edit", params, projectName });

          return {
            name: projectName,
            production_branch: params.production_branch,
          };
        },
        get: async (projectName, params) => {
          calls.push({ name: "get", params, projectName });

          return {
            name: projectName,
            production_branch: "old-main",
          };
        },
      }),
    );

    await deps.ensureProject({
      accountId: "account",
      productionBranch: "main",
      projectName: "demo-webapp",
    });

    assert.deepEqual(calls, [
      {
        name: "get",
        params: { account_id: "account" },
        projectName: "demo-webapp",
      },
      {
        name: "edit",
        params: {
          account_id: "account",
          production_branch: "main",
        },
        projectName: "demo-webapp",
      },
    ]);
  });

  it("creates a missing Pages project", async () => {
    const calls: Array<{
      name: string;
      params?: unknown;
      projectName?: string;
    }> = [];
    const deps = createCloudflarePagesDependency(
      fakeClient({
        create: async (params) => {
          calls.push({ name: "create", params });

          return {
            name: params.name,
            production_branch: params.production_branch,
          };
        },
        get: async () => {
          throw notFoundError();
        },
      }),
    );

    assert.deepEqual(
      await deps.ensureProject({
        accountId: "account",
        productionBranch: "main",
        projectName: "demo-webapp",
      }),
      {
        name: "demo-webapp",
        production_branch: "main",
      },
    );
    assert.deepEqual(calls, [
      {
        name: "create",
        params: {
          account_id: "account",
          name: "demo-webapp",
          production_branch: "main",
        },
      },
    ]);
  });

  it("rethrows non-not-found project lookup errors", async () => {
    const deps = createCloudflarePagesDependency(
      fakeClient({
        get: async () => {
          throw new Error("Cloudflare is unavailable");
        },
      }),
    );

    await assert.rejects(
      () =>
        deps.ensureProject({
          accountId: "account",
          productionBranch: "main",
          projectName: "demo-webapp",
        }),
      /Cloudflare is unavailable/,
    );
  });

  it("disables and verifies Git automatic deployments", async () => {
    const calls: Array<{
      name: string;
      params?: unknown;
      projectName?: string;
    }> = [];
    const deps = createCloudflarePagesDependency(
      fakeClient({
        edit: async (projectName, params) => {
          calls.push({ name: "edit", params, projectName });

          return {
            name: projectName,
          };
        },
        get: async (projectName, params) => {
          calls.push({ name: "get", params, projectName });

          return disabledProject(projectName);
        },
      }),
    );

    assert.deepEqual(
      await deps.disableAutomaticDeployments({
        accountId: "account",
        productionBranch: "main",
        projectName: "demo-webapp",
      }),
      disabledProject("demo-webapp"),
    );
    assert.deepEqual(calls, [
      {
        name: "edit",
        params: {
          account_id: "account",
          production_branch: "main",
          source: {
            config: {
              deployments_enabled: false,
              preview_deployment_setting: "none",
              production_deployments_enabled: false,
            },
          },
        },
        projectName: "demo-webapp",
      },
      {
        name: "get",
        params: { account_id: "account" },
        projectName: "demo-webapp",
      },
    ]);
  });

  it("rejects when automatic deployments remain enabled after update", async () => {
    const deps = createCloudflarePagesDependency(
      fakeClient({
        get: async (projectName) => ({
          name: projectName,
          source: {
            config: {
              deployments_enabled: true,
              preview_deployment_setting: "all",
              production_deployments_enabled: true,
            },
          },
        }),
      }),
    );

    await assert.rejects(
      () =>
        deps.disableAutomaticDeployments({
          accountId: "account",
          productionBranch: "main",
          projectName: "demo-webapp",
        }),
      /still has automatic deployments enabled/,
    );
  });

  it("requires a token for the real Cloudflare client", () => {
    assert.throws(
      () => createCloudflarePagesClient({ apiToken: "" }),
      /CLOUDFLARE_API_TOKEN is required/,
    );
  });
});

function disabledProject(projectName: string): CloudflarePagesProject {
  return {
    name: projectName,
    source: {
      config: {
        deployments_enabled: false,
        preview_deployment_setting: "none",
        production_deployments_enabled: false,
      },
    },
  };
}

function fakeClient(
  handlers: Partial<CloudflarePagesClientLike["pages"]["projects"]> = {},
): CloudflarePagesClientLike {
  return {
    pages: {
      projects: {
        create:
          handlers.create ??
          (async (params) => ({
            name: params.name,
            production_branch: params.production_branch,
          })),
        edit:
          handlers.edit ??
          (async (projectName) => ({
            name: projectName,
          })),
        get:
          handlers.get ??
          (async (projectName) => ({
            name: projectName,
          })),
      },
    },
  };
}

function notFoundError(): Error {
  const error = new Error("404 Not Found") as Error & {
    status: number;
  };
  error.status = 404;
  return error;
}
