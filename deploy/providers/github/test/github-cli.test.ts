import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createGitHubCliRepositoryDependency } from "../src/index.js";
import type { GitHubCliRunner } from "../src/index.js";

describe("GitHub CLI dependency", () => {
  it("sets variables with gh variable set", async () => {
    const calls: Array<{
      args: string[];
      stdin?: string;
    }> = [];
    const runGh: GitHubCliRunner = async (args, options = {}) => {
      calls.push({ args, stdin: options.stdin });
    };
    const repository = createGitHubCliRepositoryDependency({ runGh });

    await repository.setVariable({
      name: "GCP_PROJECT_ID",
      repository: "BeltOrg/beltapp",
      value: "demo-project",
    });

    assert.deepEqual(calls, [
      {
        args: [
          "variable",
          "set",
          "GCP_PROJECT_ID",
          "--repo",
          "BeltOrg/beltapp",
          "--body",
          "demo-project",
        ],
        stdin: undefined,
      },
    ]);
  });

  it("sets secrets through stdin instead of command arguments", async () => {
    const calls: Array<{
      args: string[];
      stdin?: string;
    }> = [];
    const runGh: GitHubCliRunner = async (args, options = {}) => {
      calls.push({ args, stdin: options.stdin });
    };
    const repository = createGitHubCliRepositoryDependency({ runGh });

    await repository.setSecret({
      name: "CLOUDFLARE_API_TOKEN",
      repository: "BeltOrg/beltapp",
      value: "cloudflare-secret-token",
    });

    assert.deepEqual(calls, [
      {
        args: [
          "secret",
          "set",
          "CLOUDFLARE_API_TOKEN",
          "--repo",
          "BeltOrg/beltapp",
        ],
        stdin: "cloudflare-secret-token",
      },
    ]);
  });
});
