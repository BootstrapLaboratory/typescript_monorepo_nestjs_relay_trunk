import * as assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildDeployTargetCommand,
  buildGithubDeployTagUpdateRequests,
  deployTagName,
  updateDeployTagWithGithubApi,
} from "../src/stages/deploy/deploy-tag.ts";

test("builds deploy tag names from environment and target", () => {
  assert.equal(deployTagName("prod", "server"), "deploy/prod/server");
  assert.equal(deployTagName("staging", "webapp"), "deploy/staging/webapp");
});

test("builds GitHub deploy tag update requests", () => {
  const requests = buildGithubDeployTagUpdateRequests({
    gitSha: "ABCDEF1234567890ABCDEF1234567890ABCDEF12",
    repository: "BeltOrg/beltapp",
    tagName: "deploy/prod/server",
  });

  assert.deepStrictEqual(requests, {
    create: {
      body: JSON.stringify({
        ref: "refs/tags/deploy/prod/server",
        sha: "abcdef1234567890abcdef1234567890abcdef12",
      }),
      method: "POST",
      url: "https://api.github.com/repos/BeltOrg/beltapp/git/refs",
    },
    update: {
      body: JSON.stringify({
        force: true,
        sha: "abcdef1234567890abcdef1234567890abcdef12",
      }),
      method: "PATCH",
      url: "https://api.github.com/repos/BeltOrg/beltapp/git/refs/tags/deploy/prod/server",
    },
  });
});

test("fails when building GitHub deploy tag requests without a full SHA", () => {
  assert.throws(
    () =>
      buildGithubDeployTagUpdateRequests({
        gitSha: "abc123",
        repository: "BeltOrg/beltapp",
        tagName: "deploy/prod/server",
      }),
    /Git SHA must be a full 40-character SHA/,
  );
});

test("creates a missing deploy tag through the GitHub API", async () => {
  const originalFetch = globalThis.fetch;
  const originalLog = console.log;
  const calls: Array<{ body?: BodyInit | null; method?: string; url: string }> =
    [];

  console.log = () => undefined;
  globalThis.fetch = (async (input, init) => {
    calls.push({
      body: init?.body,
      method: init?.method,
      url: String(input),
    });

    return new Response("", {
      status: calls.length === 1 ? 404 : 201,
    });
  }) as typeof fetch;

  try {
    const output = await updateDeployTagWithGithubApi(
      "prod",
      "server",
      "abcdef1234567890abcdef1234567890abcdef12",
      {
        GITHUB_REPOSITORY: "BeltOrg/beltapp",
        GITHUB_TOKEN: "github-token",
      },
      "GITHUB_TOKEN",
    );

    assert.equal(
      output,
      "[deploy-release] created deploy tag deploy/prod/server\n",
    );
    assert.deepStrictEqual(
      calls.map(({ method, url }) => ({ method, url })),
      [
        {
          method: "PATCH",
          url: "https://api.github.com/repos/BeltOrg/beltapp/git/refs/tags/deploy/prod/server",
        },
        {
          method: "POST",
          url: "https://api.github.com/repos/BeltOrg/beltapp/git/refs",
        },
      ],
    );
  } finally {
    globalThis.fetch = originalFetch;
    console.log = originalLog;
  }
});

test("builds deploy target command from the target script only", () => {
  const command = buildDeployTargetCommand(
    "deploy/cloudrun/scripts/deploy-server.sh",
  );

  assert.equal(command, "bash deploy/cloudrun/scripts/deploy-server.sh");
});
